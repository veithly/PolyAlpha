export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { fetchMarketDetail } from '@/domain/markets/service';
import { listQaLogs, logQaInteraction } from '@/domain/qa/service';
import {
  getEffectiveDailyLimit,
  getUsageCount,
  incrementUsage,
} from '@/domain/qa/quota';
import { askAiQuestion, currentProvider } from '@/lib/ai';
import { isAnswerSafe, isQuestionAllowed, redactAnswer } from '@/lib/guardrails';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';
import type { MarketDetail } from '@/domain/types';

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  const result = await Promise.race([promise.catch(() => fallback), timeout]);
  clearTimeout(timer!);
  return result as T;
}

const handler = async (request: NextRequest) => {
  const startedAt = Date.now();
  try {
    const payload = (await request.json()) as {
      walletAddress?: string;
      marketId?: string;
      question?: string;
      contextNote?: string;
    };

    if (!payload.question || !payload.walletAddress) {
      return failure(
        'INVALID_REQUEST',
        'walletAddress and question are required.',
        { status: 400 }
      );
    }

    const isGlobal = !payload.marketId || payload.marketId === 'global';
    const walletAddress = payload.walletAddress.trim().toLowerCase();
    const allowed = await isQuestionAllowed(payload.question);
    if (!allowed) {
      return failure(
        'ASK_GUARDRAIL_TRIGGERED',
        'Question blocked by safety rules.',
        { status: 400 }
      );
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    const limit = await withTimeout(getEffectiveDailyLimit(walletAddress), 1200, 10);
    const used = await withTimeout(getUsageCount(walletAddress, dateKey), 1200, 0);

    if (used >= limit) {
      logTelemetry({
        walletAddress,
        marketId: payload.marketId,
        success: false,
        reason: 'limit',
        durationMs: Date.now() - startedAt,
      });
      return failure('ASK_LIMIT_EXCEEDED', 'Daily Ask AI limit reached.', {
        status: 429,
        details: { remainingQuota: 0, limit },
      });
    }

    let detail: MarketDetail | null = null;
    if (isGlobal) {
      const now = new Date().toISOString();
      detail = {
        id: 'global',
        title: 'Global pulse',
        category: 'macro',
        topics: ['macro'],
        status: 'open',
        yesProbability: 0.5,
        yesPrice: 0.5,
        change24h: 0,
        volume24h: 0,
        liquidity: 0,
        isHot: false,
        isSpike: false,
        polymarketUrl: 'https://polymarket.com',
        updatedAt: now,
        priceSeries: [],
        volumeSeries: [],
        description:
          payload.contextNote ??
          'General AI query without a specific market context.',
      };
    } else {
      try {
        detail = await fetchMarketDetail(payload.marketId!);
      } catch (error) {
        console.warn('[api] ask market detail fetch failed, falling back', error);
      }
      if (!detail) {
        // fall back to a minimal shell so the user still gets an answer
        detail = {
          id: payload.marketId!,
          title: payload.contextNote ?? `Market ${payload.marketId}`,
          category: 'unknown',
          topics: [],
          status: 'open',
          yesProbability: 0.5,
          yesPrice: 0.5,
          change24h: 0,
          volume24h: 0,
          liquidity: 0,
          isHot: false,
          isSpike: false,
          polymarketUrl: 'https://polymarket.com',
          updatedAt: new Date().toISOString(),
          priceSeries: [],
          volumeSeries: [],
          description: payload.contextNote ?? 'Market detail unavailable; using fallback context.',
        };
      }
    }

    await withTimeout(incrementUsage(walletAddress, dateKey), 1200, null);

    const history =
      (await withTimeout(
        listQaLogs({
          walletAddress,
          marketId: isGlobal ? 'global' : payload.marketId!,
          limit: 5,
        }),
        1800,
        { items: [] }
      )) ?? { items: [] };

    let aiAnswer: string | null = null;
    try {
      aiAnswer = await askAiQuestion({
        market: detail,
        question: payload.question,
        contextNote: payload.contextNote,
        history: history
          .map((entry) => ({
            question: entry.question,
            answer: entry.answer,
          }))
          .reverse(),
        timeoutMs: 20_000,
      });
    } catch (err) {
      console.warn('[api] ask ai call failed', err);
    }

    const duration = Date.now() - startedAt;

    if (!aiAnswer) {
      const timedOut = duration >= 19_000;
      const provider = currentProvider();
      logTelemetry({
        walletAddress,
        marketId: payload.marketId,
        success: false,
        reason: timedOut ? 'timeout' : 'ai_failed',
        durationMs: duration,
      });
      return failure(
        timedOut ? 'ASK_TIMEOUT' : 'ASK_FAILED',
        timedOut ? 'AI timed out. Please try again.' : 'AI could not generate an answer.',
        {
          status: timedOut ? 504 : 502,
          details: { provider },
        }
      );
    }

    const finalAnswer = aiAnswer;

    const redaction = redactAnswer(finalAnswer.trim());
    const safe = await isAnswerSafe(redaction.text);
    if (!safe) {
      return failure('ASK_OUTPUT_BLOCKED', 'Answer blocked by safety rules.', {
        status: 502,
        details: { guardrail: { question: 'allow', answer: 'block' } },
      });
    }

    await withTimeout(
      logQaInteraction({
        walletAddress: payload.walletAddress,
        marketId: isGlobal ? 'global' : payload.marketId!,
        question: payload.question,
        answer: redaction.text,
      }),
      1500,
      null
    );

    const remaining = Math.max(limit - (used + 1), 0);

    logTelemetry({
      walletAddress,
      marketId: payload.marketId,
      success: true,
      durationMs: Date.now() - startedAt,
      reason: aiAnswer ? 'ok' : 'fallback',
      remainingQuota: remaining,
    });

    return success({
      answer: redaction.text,
      remainingQuota: remaining,
      limit,
      guardrail: {
        question: 'allow',
        answer: safe ? 'allow' : 'block',
        redacted: redaction.redacted,
        redactions: redaction.redactions,
      },
    });
  } catch (error) {
    console.error('[api] ask error', error);
    return failure(
      'ASK_FAILED',
      'Unable to generate an answer right now.',
      { status: 502 }
    );
  }
};

export const POST = withApiLogging(handler, { action: 'ask.create' });

function logTelemetry(details: {
  walletAddress: string;
  marketId?: string;
  success: boolean;
  durationMs: number;
  remainingQuota?: number;
  reason?: string;
}) {
  console.log(
    JSON.stringify({
      event: 'ask_ai',
      walletAddress: details.walletAddress,
      marketId: details.marketId,
      success: details.success,
      durationMs: details.durationMs,
      remainingQuota: details.remainingQuota,
      reason: details.reason,
      timestamp: new Date().toISOString(),
    })
  );
}
