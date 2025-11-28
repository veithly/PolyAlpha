import { NextRequest } from 'next/server';
import { ReadableStream } from 'node:stream/web';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { POST } from '@/app/api/ask/stream/route';
import { fetchMarketDetail } from '@/domain/markets/service';
import { listQaLogs } from '@/domain/qa/service';
import {
  getEffectiveDailyLimit,
  getUsageCount,
  incrementUsage,
} from '@/domain/qa/quota';
import { askAiQuestionStream } from '@/lib/ai';
import { isAnswerSafe, isQuestionAllowed } from '@/lib/guardrails';

vi.mock('@/domain/markets/service', () => ({
  fetchMarketDetail: vi.fn(),
}));
vi.mock('@/domain/qa/service', () => ({
  listQaLogs: vi.fn(),
  logQaInteraction: vi.fn(),
}));
vi.mock('@/domain/qa/quota', () => ({
  getEffectiveDailyLimit: vi.fn(() => Promise.resolve(10)),
  getUsageCount: vi.fn(() => Promise.resolve(0)),
  incrementUsage: vi.fn(),
}));
vi.mock('@/lib/ai', () => ({
  askAiQuestionStream: vi.fn(),
}));
vi.mock('@/lib/guardrails', () => ({
  isQuestionAllowed: vi.fn(() => Promise.resolve(true)),
  isAnswerSafe: vi.fn(() => Promise.resolve(true)),
}));

const mockedFetchDetail = vi.mocked(fetchMarketDetail);
const mockedListQaLogs = vi.mocked(listQaLogs);
const mockedGetLimit = vi.mocked(getEffectiveDailyLimit);
const mockedGetUsage = vi.mocked(getUsageCount);
const mockedIncrement = vi.mocked(incrementUsage);
const mockedStream = vi.mocked(askAiQuestionStream);
const mockedGuard = vi.mocked(isQuestionAllowed);
const mockedAnswerSafe = vi.mocked(isAnswerSafe);

describe('POST /api/ask/stream', () => {
  beforeEach(() => {
    mockedFetchDetail.mockReset();
    mockedListQaLogs.mockReset();
    mockedGetLimit.mockReset();
    mockedGetUsage.mockReset();
    mockedIncrement.mockReset();
    mockedStream.mockReset();
    mockedFetchDetail.mockResolvedValue({
      id: 'm',
      title: 'M',
      category: 'Crypto',
      topics: ['crypto'],
      status: 'open',
      yesProbability: 0.4,
      yesPrice: 0.4,
      change24h: 0,
      volume24h: 0,
      totalVolume: 0,
      liquidity: 0,
      isHot: false,
      isSpike: false,
      polymarketUrl: '#',
      updatedAt: new Date().toISOString(),
      priceSeries: [],
      volumeSeries: [],
    });
    mockedListQaLogs.mockResolvedValue([]);
    mockedGetLimit.mockResolvedValue(10);
    mockedGetUsage.mockResolvedValue(0);
    mockedGuard.mockResolvedValue(true);
    mockedAnswerSafe.mockResolvedValue(true);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('Hello'));
        controller.close();
      },
    });
    mockedStream.mockResolvedValue(stream);
  });

  it('rejects when over quota', async () => {
    mockedGetUsage.mockResolvedValue(10);
    const res = await POST(
      new NextRequest('http://localhost/api/ask/stream', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: '0xabc', marketId: 'm', question: 'Hi' }),
      })
    );
    expect(res.status).toBe(429);
  });

  it('streams response when OK', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/ask/stream', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: '0xabc', marketId: 'm', question: 'Hi' }),
      })
    );
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body).toBeInstanceOf(ReadableStream);
  });

  it('blocks guardrail terms', async () => {
    mockedGuard.mockResolvedValue(false);
    const res = await POST(
      new NextRequest('http://localhost/api/ask/stream', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: '0xabc', marketId: 'm', question: 'How to ddos?' }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('halts when output unsafe', async () => {
    mockedAnswerSafe.mockResolvedValue(false);
    const res = await POST(
      new NextRequest('http://localhost/api/ask/stream', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: '0xabc', marketId: 'm', question: 'Hi' }),
      })
    );
    expect(res.status).toBe(200);
  });
});
