import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, POST } from '@/app/api/markets/watchlist/route';
import { DELETE } from '@/app/api/markets/watchlist/[marketId]/route';
import {
  addToWatchlist,
  fetchWatchlistMarkets,
  listWatchlistIds,
  removeFromWatchlist,
} from '@/domain/markets/watchlist';

vi.mock('@/domain/markets/watchlist', () => ({
  addToWatchlist: vi.fn(),
  fetchWatchlistMarkets: vi.fn(),
  listWatchlistIds: vi.fn(),
  removeFromWatchlist: vi.fn(),
}));

describe('watchlist API', () => {
  beforeEach(() => {
    vi.mocked(addToWatchlist).mockReset();
    vi.mocked(fetchWatchlistMarkets).mockReset();
    vi.mocked(listWatchlistIds).mockReset();
    vi.mocked(removeFromWatchlist).mockReset();
  });

  it('requires wallet header on GET', async () => {
    const request = new NextRequest('http://localhost/api/markets/watchlist');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('returns watchlist markets', async () => {
    vi.mocked(listWatchlistIds).mockResolvedValue(['1']);
    vi.mocked(fetchWatchlistMarkets).mockResolvedValue([
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
        totalVolume: 5000,
        liquidity: 2000,
        isHot: true,
        isSpike: false,
        polymarketUrl: 'https://polymarket.com',
        updatedAt: new Date().toISOString(),
      },
    ]);

    const request = new NextRequest('http://localhost/api/markets/watchlist', {
      headers: { 'x-wallet-address': '0xabc' },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { ids: ['1'], items: expect.any(Array) },
    });
  });

  it('adds entries on POST', async () => {
    const request = new NextRequest('http://localhost/api/markets/watchlist', {
      method: 'POST',
      body: JSON.stringify({ marketId: '1' }),
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': '0xabc',
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(addToWatchlist).toHaveBeenCalledWith({
      walletAddress: '0xabc',
      marketId: '1',
    });
  });

  it('removes entries on DELETE', async () => {
    const request = new NextRequest(
      'http://localhost/api/markets/watchlist/1',
      {
        method: 'DELETE',
        headers: { 'x-wallet-address': '0xabc' },
      }
    );
    const response = await DELETE(request, { params: { marketId: '1' } });
    expect(response.status).toBe(200);
    expect(removeFromWatchlist).toHaveBeenCalledWith({
      walletAddress: '0xabc',
      marketId: '1',
    });
  });
});
