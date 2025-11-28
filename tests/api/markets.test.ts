import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from '@/app/api/markets/route';
import { fetchMarketsWithMeta } from '@/domain/markets/service';

vi.mock('@/domain/markets/service', () => ({
  fetchMarketsWithMeta: vi.fn(),
}));

const mockedFetchMarketsWithMeta = vi.mocked(fetchMarketsWithMeta);

describe('GET /api/markets', () => {
  beforeEach(() => {
    mockedFetchMarketsWithMeta.mockReset();
  });

  it('returns market list with filters', async () => {
    mockedFetchMarketsWithMeta.mockResolvedValue({
      source: 'live',
      cursor: '12',
      lastUpdated: new Date().toISOString(),
      items: [
        {
          id: '1',
          title: 'Sample',
          category: 'Crypto',
          topics: ['crypto'],
          status: 'open',
          yesProbability: 0.5,
          yesPrice: 0.5,
          change24h: 0.1,
          volume24h: 1000,
          totalVolume: 2000,
          liquidity: 500,
          isHot: true,
          isSpike: false,
          polymarketUrl: 'https://polymarket.com',
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const request = new NextRequest(
      'http://localhost/api/markets?limit=5&sort=hot&topics=crypto&volume24hMin=5000&liquidityMin=2000&change24hMin=0.1&change24hMax=0.3'
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.cursor).toBe('12');
    expect(body.data.source).toBe('live');
    expect(body.data.lastUpdated).toBeTruthy();
    expect(mockedFetchMarketsWithMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 5,
        sort: 'hot',
        topics: ['crypto'],
        volume24hMin: 5000,
        liquidityMin: 2000,
        change24hMin: 0.1,
        change24hMax: 0.3,
        cursor: undefined,
        fallbackCache: true,
      })
    );
  });

  it('parses cursor and forwards to service', async () => {
    mockedFetchMarketsWithMeta.mockResolvedValue({
      source: 'live',
      cursor: undefined,
      lastUpdated: new Date().toISOString(),
      items: [],
    });

    const request = new NextRequest('http://localhost/api/markets?cursor=12&limit=10');
    await GET(request);

    expect(mockedFetchMarketsWithMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: 12,
        limit: 10,
        fallbackCache: true,
      })
    );
  });

  it('handles fetch failures', async () => {
    mockedFetchMarketsWithMeta.mockRejectedValue(new Error('network'));
    const request = new NextRequest('http://localhost/api/markets');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.success).toBe(false);
  });
});
