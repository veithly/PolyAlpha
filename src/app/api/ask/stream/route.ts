export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { fetchMarketDetail } from '@/domain/markets/service';
import { listQaLogs, logQaInteraction } from '@/domain/qa/service';
import {
  getEffectiveDailyLimit,
  getUsageCount,
  incrementUsage,
} from '@/domain/qa/quota';
import { askAiQuestion, askAiQuestionStream } from '@/lib/ai';
import { isAnswerSafe, isQuestionAllowed, redactAnswer } from '@/lib/guardrails';
import { failure } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';
import type { MarketDetail } from '@/domain/types';

const handler = async (request: NextRequest) => {
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

    const stream = await askAiQuestionStream({
      market: detail,
      question: payload.question,
      contextNote: payload.contextNote,
      history: history
        .map((entry) => ({
          question: entry.question,
          answer: entry.answer,
        }))
        .reverse(),
    });

    if (!stream) {
      const fallback = await askAiQuestion({
        market: detail,
        question: payload.question,
        contextNote: payload.contextNote,
        history: history
          .map((entry) => ({
            question: entry.question,
            answer: entry.answer,
          }))
          .reverse(),
      });
      if (!fallback) {
        return failure('ASK_FAILED', 'Unable to generate an answer.', {
          status: 502,
        });
      }
      return new Response(fallback, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    const [clientStream, logStream] = stream.tee();
    const decoder = new TextDecoder();
    (async () => {
      const reader = logStream.getReader();
      let fullAnswer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        fullAnswer += decoder.decode(value, { stream: true });
      }
      fullAnswer += decoder.decode();
      if (fullAnswer.trim()) {
        const redaction = redactAnswer(fullAnswer.trim());
        const safe = await isAnswerSafe(redaction.text);
        if (!safe) {
          return;
        }
        await logQaInteraction({
          walletAddress: payload.walletAddress!,
          marketId: isGlobal ? 'global' : payload.marketId!,
          question: payload.question!,
          answer: redaction.text,
        });
      }
    })().catch(() => {});

    return new Response(clientStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Guardrail-Question': 'allow',
      },
    });
  } catch (error) {
    console.error('[api] ask stream error', error);
    return failure('ASK_FAILED', 'Unable to stream answer.', { status: 502 });
  }
};

export const POST = withApiLogging(handler, { action: 'ask.stream' });
