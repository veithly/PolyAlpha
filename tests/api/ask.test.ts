import { NextRequest } from 'next/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { POST } from '@/app/api/ask/route';
import { GET as GET_LOGS } from '@/app/api/ask/logs/route';
import { fetchMarketDetail } from '@/domain/markets/service';
import { listQaLogs, logQaInteraction } from '@/domain/qa/service';
import {
  getEffectiveDailyLimit,
  getUsageCount,
  incrementUsage,
} from '@/domain/qa/quota';
import { askAiQuestion } from '@/lib/ai';
import { isAnswerSafe, isQuestionAllowed } from '@/lib/guardrails';

vi.mock('@/domain/markets/service', () => ({
  fetchMarketDetail: vi.fn(),
}));
vi.mock('@/domain/qa/service', () => ({
  logQaInteraction: vi.fn(),
  listQaLogs: vi.fn(),
}));
vi.mock('@/domain/qa/quota', () => ({
  getEffectiveDailyLimit: vi.fn(() => Promise.resolve(10)),
  getUsageCount: vi.fn(),
  incrementUsage: vi.fn(),
}));
vi.mock('@/lib/ai', () => ({
  askAiQuestion: vi.fn(),
}));
vi.mock('@/lib/guardrails', () => ({
  isQuestionAllowed: vi.fn(() => Promise.resolve(true)),
  isAnswerSafe: vi.fn(() => Promise.resolve(true)),
  redactAnswer: vi.fn((text: string) => ({
    text,
    redacted: false,
    redactions: [],
  })),
}));

const mockedFetchDetail = vi.mocked(fetchMarketDetail);
const mockedLogQa = vi.mocked(logQaInteraction);
const mockedListQaLogs = vi.mocked(listQaLogs);
const mockedAsk = vi.mocked(askAiQuestion);
const mockedGetUsage = vi.mocked(getUsageCount);
const mockedGetLimit = vi.mocked(getEffectiveDailyLimit);
const mockedIncrementUsage = vi.mocked(incrementUsage);
const mockedGuard = vi.mocked(isQuestionAllowed);
const mockedAnswerSafe = vi.mocked(isAnswerSafe);

describe('POST /api/ask', () => {
  beforeEach(() => {
    mockedFetchDetail.mockReset();
    mockedLogQa.mockReset();
    mockedListQaLogs.mockReset();
    mockedAsk.mockReset();
    mockedGetUsage.mockReset();
    mockedGetLimit.mockReset();
    mockedIncrementUsage.mockReset();
    mockedGetUsage.mockResolvedValue(0);
    mockedIncrementUsage.mockResolvedValue(1);
    mockedGetLimit.mockResolvedValue(10);
    mockedGuard.mockResolvedValue(true);
    mockedAnswerSafe.mockResolvedValue(true);
  });

  it('validates payload', async () => {
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(response.status).toBe(400);
  });

  it('returns answer when AI succeeds', async () => {
    mockedFetchDetail.mockResolvedValue({
      id: 'm',
      title: 'Market',
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
    mockedAsk.mockResolvedValue('Answer');
    mockedListQaLogs.mockResolvedValue([]);

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          marketId: 'm',
          question: 'Why?',
          walletAddress: '0xabc',
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    const body = await response.json();
    expect(body.data.answer).toBe('Answer');
    expect(mockedLogQa).toHaveBeenCalled();
    expect(mockedGetLimit).toHaveBeenCalledWith('0xabc');
  });

  it('handles missing market', async () => {
    mockedFetchDetail.mockResolvedValue(null);
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          marketId: 'missing',
          question: 'Hi',
          walletAddress: '0xabc',
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(response.status).toBe(404);
  });

  it('handles AI failure', async () => {
    mockedFetchDetail.mockResolvedValue({
      id: 'm',
      title: 'Market',
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
    mockedAsk.mockResolvedValue(null);
    mockedListQaLogs.mockResolvedValue([]);

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          marketId: 'm',
          question: 'Hi',
          walletAddress: '0xabc',
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(response.status).toBe(502);
  });

  it('blocks unsafe answer', async () => {
    mockedAnswerSafe.mockResolvedValue(false);
    mockedFetchDetail.mockResolvedValue({
      id: 'm',
      title: 'Market',
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
    mockedAsk.mockResolvedValue('Answer');
    mockedListQaLogs.mockResolvedValue([]);

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          marketId: 'm',
          question: 'Why?',
          walletAddress: '0xabc',
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(response.status).toBe(502);
  });

  it('blocks guardrail terms', async () => {
    mockedGuard.mockResolvedValue(false);
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          marketId: 'm',
          question: 'How to ddos?',
          walletAddress: '0xabc',
        }),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(response.status).toBe(400);
  });
});

describe('GET /api/ask/logs', () => {
  beforeEach(() => {
    mockedListQaLogs.mockReset();
  });

  it('requires wallet address', async () => {
    const response = await GET_LOGS(
      new NextRequest('http://localhost/api/ask/logs')
    );
    expect(response.status).toBe(400);
  });

  it('returns logs', async () => {
    mockedListQaLogs.mockResolvedValue([
      {
        id: '1',
        walletAddress: '0xabc',
        marketId: 'm',
        question: 'Q1',
        answer: 'A1',
        createdAt: new Date().toISOString(),
      },
    ]);
    const response = await GET_LOGS(
      new NextRequest(
        'http://localhost/api/ask/logs?walletAddress=0xabc&marketId=m'
      )
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.items).toHaveLength(1);
    expect(mockedListQaLogs).toHaveBeenCalledWith({
      walletAddress: '0xabc',
      marketId: 'm',
      limit: 5,
    });
  });
});
