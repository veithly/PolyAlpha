import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchMarketDetailFromPolymarket,
  fetchMarketsFromPolymarket,
} from '../../src/lib/polymarket';

describe('polymarket data layer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps market list payload into summaries', async () => {
    const fetchMock = stubFetch({
      events: [
        {
          title: 'Crypto mega basket',
          category: 'Crypto',
          tags: ['crypto'],
          updatedAt: new Date().toISOString(),
          markets: [
            {
              id: '123',
              question: 'Will BTC break $100k?',
              tags: ['crypto', 'custom-topic'],
              endDateIso: '2026-01-01T00:00:00Z',
              yesPrice: 0.42,
              change24h: 0.12,
              volume24h: 6000,
              url: 'https://polymarket.com/event/123',
            },
          ],
        },
      ],
    });

    const result = await fetchMarketsFromPolymarket({ limit: 5, sort: 'hot' });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '123',
      title: 'Will BTC break $100k?',
      category: 'Crypto',
      topics: ['crypto'],
      yesPrice: 0.42,
      yesProbability: 0.42,
      isHot: true,
      polymarketUrl: 'https://polymarket.com/event/123',
    });
    expect(result[0].updatedAt).toBeDefined();
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(requestUrl.toString()).toContain('/markets?limit=5');
    expect(requestInit).toMatchObject({ cache: 'no-store' });
  });

  it('returns empty list when request fails', async () => {
    stubFetch(null, { ok: false, status: 502 });

    const result = await fetchMarketsFromPolymarket();
    expect(result).toEqual([]);
  });

  it('hydrates market detail with series data', async () => {
    stubFetch({
      market: {
      id: 'abc',
      question: 'Election outcome?',
      description: 'Who wins?',
      yesPrice: 0.6,
      endDateIso: '2026-01-01T00:00:00Z',
      priceHistory: [
        { timestamp: 1731988800, price: 0.5 },
        { timestamp: '2025-11-18T00:00:00Z', price: 0.55 },
      ],
        volumeHistory: [
          { timestamp: 1731988800, volume: 1200 },
          { t: 1732075200000, amount: 900 },
        ],
      },
    });

    const detail = await fetchMarketDetailFromPolymarket('abc');

    expect(detail).not.toBeNull();
    expect(detail?.priceSeries).toHaveLength(2);
    expect(detail?.volumeSeries).toHaveLength(2);
    expect(detail?.description).toBe('Who wins?');
  });

  it('returns null when market id missing', async () => {
    stubFetch({ market: null });

    const detail = await fetchMarketDetailFromPolymarket('missing-id');
    expect(detail).toBeNull();
  });

  it('fetches by tag id when topics provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tags: [{ id: '21', slug: 'crypto' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          markets: [
            {
              id: 'crypto-1',
              question: 'Will ETH flip BTC?',
              tags: ['crypto'],
              updatedAt: new Date().toISOString(),
              endDateIso: '2026-01-01T00:00:00Z',
              yesPrice: 0.33,
              change24h: 0.05,
              volume24h: 9000,
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMarketsFromPolymarket({ topics: ['crypto'], limit: 5 });

    expect(fetchMock.mock.calls[0][0].toString()).toContain('/public-search');
    expect(fetchMock.mock.calls[1][0].toString()).toContain('tag_id=21');
    expect(result[0]).toMatchObject({ id: 'crypto-1', topics: ['crypto'] });
  });

  it('derives probability, change and category from alternate fields', async () => {
    const now = Date.now();
    stubFetch({
      markets: [
        {
          id: 'alt-fields-1',
          question: 'Will rates fall in 2026?',
          tags: [{ slug: 'macro' }],
          probability: 0.73,
          volume24h: 12000,
          endDateIso: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
          priceHistory: [
            { ts: now - 25 * 60 * 60 * 1000, p: 0.6 },
            { ts: now - 60 * 60 * 1000, p: 0.7 },
          ],
        },
      ],
    });

    const result = await fetchMarketsFromPolymarket({ limit: 5 });
    expect(result).toHaveLength(1);
    const market = result[0];
    expect(market.yesProbability).toBeCloseTo(0.73, 2);
    expect(market.change24h).toBeCloseTo((0.7 - 0.6) / 0.6, 2);
    expect(market.topics).toContain('macro');
    expect(market.category).toBe('Macro');
  });

  it('categorises company/stock style questions as macro', async () => {
    stubFetch({
      markets: [
        {
          id: 'tsla-test',
          question: 'Will Tesla be the second-largest company by market cap?',
          tags: [],
          updatedAt: new Date().toISOString(),
          endDateIso: new Date(Date.now() + 86400000).toISOString(),
          yesPrice: 0.1,
          change24h: 0.02,
          volume24h: 10000,
        },
      ],
    });

    const result = await fetchMarketsFromPolymarket({ limit: 1 });
    expect(result[0].topics).toContain('macro');
    expect(result[0].category).toBe('Macro');
  });

  it('categorises when only title is provided', async () => {
    stubFetch({
      markets: [
        {
          id: 'oracle-test',
          title: 'Will Oracle be the second-largest company in the world by market cap?',
          updatedAt: new Date().toISOString(),
          endDateIso: new Date(Date.now() + 86400000).toISOString(),
          yesPrice: 0.02,
          volume24h: 5000,
        },
      ],
    });

    const result = await fetchMarketsFromPolymarket({ limit: 1 });
    expect(result[0].topics).toContain('macro');
    expect(result[0].category).toBe('Macro');
  });

  it('categorises music/artist questions as meme', async () => {
    stubFetch({
      markets: [
        {
          id: 'music-test',
          question: 'Will Bruno Mars be the top Spotify artist for 2025?',
          updatedAt: new Date().toISOString(),
          endDateIso: new Date(Date.now() + 86400000).toISOString(),
          yesPrice: 0.02,
          volume24h: 12000,
        },
      ],
    });

    const result = await fetchMarketsFromPolymarket({ limit: 1 });
    expect(result[0].topics).toContain('meme');
    expect(result[0].category).toBe('Meme');
  });

  it('categorises nfl team references as sports', async () => {
    stubFetch({
      markets: [
        {
          id: 'cowboys-test',
          question: 'Will the Dallas Cowboys win Super Bowl 2026?',
          updatedAt: new Date().toISOString(),
          endDateIso: new Date(Date.now() + 86400000).toISOString(),
          yesPrice: 0.03,
          volume24h: 8000,
        },
      ],
    });

    const result = await fetchMarketsFromPolymarket({ limit: 1 });
    expect(result[0].topics).toContain('sports');
    expect(result[0].category).toBe('Sports');
  });
});

function stubFetch(
  payload: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}
): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
