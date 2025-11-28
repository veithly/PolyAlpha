import { describe, expect, it, vi, beforeEach } from 'vitest';

import { GET } from '@/app/api/markets/[id]/summary/route';
import { fetchMarketDetail } from '@/domain/markets/service';
import {
  getMarketSummaryCache,
  upsertMarketSummary,
} from '@/domain/marketSummaries/service';
import { summarizeMarket } from '@/lib/ai';
import { fetchNews } from '@/lib/news';

vi.mock('@/domain/markets/service', () => ({
  fetchMarketDetail: vi.fn(),
}));
vi.mock('@/domain/marketSummaries/service', () => ({
  getMarketSummaryCache: vi.fn(),
  upsertMarketSummary: vi.fn(),
}));
vi.mock('@/lib/ai', () => ({
  summarizeMarket: vi.fn(),
}));
vi.mock('@/lib/news', () => ({
  fetchNews: vi.fn(),
}));

const mockedFetchDetail = vi.mocked(fetchMarketDetail);
const mockedGetCache = vi.mocked(getMarketSummaryCache);
const mockedUpsert = vi.mocked(upsertMarketSummary);
const mockedSummarize = vi.mocked(summarizeMarket);
const mockedFetchNews = vi.mocked(fetchNews);

describe('GET /api/markets/[id]/summary', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2025-11-19T00:00:00Z'));
    mockedFetchDetail.mockReset();
    mockedGetCache.mockReset();
    mockedUpsert.mockReset();
    mockedSummarize.mockReset();
    mockedFetchNews.mockReset();
    mockedFetchNews.mockResolvedValue([]);
  });

  it('returns cached summary when fresh', async () => {
    mockedGetCache.mockResolvedValue({
      marketId: 'm',
      summary: 'cached',
      language: 'en',
      model: 'qwen',
      generatedAt: new Date().toISOString(),
    });

    const response = await GET(new Request('http://localhost'), {
      params: { id: 'm' },
    });
    const body = await response.json();

    expect(body.data.summary).toBe('cached');
    expect(mockedFetchDetail).not.toHaveBeenCalled();
  });

  it('generates summary when cache missing', async () => {
    mockedGetCache.mockResolvedValue(null);
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
    mockedSummarize.mockResolvedValue({
      marketId: 'm',
      summary: 'ai',
      language: 'en',
      model: 'qwen',
      generatedAt: new Date().toISOString(),
    });
    mockedUpsert.mockResolvedValue({
      marketId: 'm',
      summary: 'ai',
      language: 'en',
      model: 'qwen',
      generatedAt: new Date().toISOString(),
    });

    const response = await GET(new Request('http://localhost'), {
      params: { id: 'm' },
    });

    expect(response.status).toBe(200);
    expect(mockedSummarize).toHaveBeenCalled();
  });

  it('returns 404 when market missing', async () => {
    mockedGetCache.mockResolvedValue(null);
    mockedFetchDetail.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost'), {
      params: { id: 'missing' },
    });
    expect(response.status).toBe(404);
  });
});
