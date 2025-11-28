export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { fetchMarketDetail } from '@/domain/markets/service';
import { listQaLogs, logQaInteraction } from '@/domain/qa/service';
import {
  getEffectiveDailyLimit,
  getUsageCount,
  incrementUsage,
} from '@/domain/qa/quota';
import { askAiQuestion } from '@/lib/ai';
import { isAnswerSafe, isQuestionAllowed, redactAnswer } from '@/lib/guardrails';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';
import type { MarketDetail } from '@/domain/types';

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
    const limit = await getEffectiveDailyLimit(walletAddress);
    const used = await getUsageCount(walletAddress, dateKey);

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
      detail = await fetchMarketDetail(payload.marketId!);
      if (!detail) {
        return failure('NOT_FOUND', 'Market not found.', { status: 404 });
      }
    }

    await incrementUsage(walletAddress, dateKey);

    const history = await listQaLogs({
      walletAddress,
      marketId: isGlobal ? 'global' : payload.marketId!,
      limit: 5,
    });

    const answer = await askAiQuestion({
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

    if (!answer) {
      const duration = Date.now() - startedAt;
      const timedOut = duration >= 19_500;
      logTelemetry({
        walletAddress,
        marketId: payload.marketId,
        success: false,
        reason: timedOut ? 'timeout' : 'ai_failed',
        durationMs: duration,
      });
      return failure(
        timedOut ? 'ASK_TIMEOUT' : 'ASK_FAILED',
        timedOut ? 'AI took too long. Please try again.' : 'Unable to generate an answer.',
        { status: timedOut ? 504 : 502 }
      );
    }

    const redaction = redactAnswer(answer.trim());
    const safe = await isAnswerSafe(redaction.text);
    if (!safe) {
      return failure('ASK_OUTPUT_BLOCKED', 'Answer blocked by safety rules.', {
        status: 502,
        details: { guardrail: { question: 'allow', answer: 'block' } },
      });
    }

    await logQaInteraction({
      walletAddress: payload.walletAddress,
      marketId: isGlobal ? 'global' : payload.marketId!,
      question: payload.question,
      answer: redaction.text,
    });

    const remaining = Math.max(limit - (used + 1), 0);

    logTelemetry({
      walletAddress,
      marketId: payload.marketId,
      success: true,
      durationMs: Date.now() - startedAt,
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
