import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as fetchInsights } from '@/app/api/insights/[cadence]/route';
import { POST as regenerateSection } from '@/app/api/insights/[cadence]/sections/route';
import { fetchMarkets, fetchMarketDetail } from '@/domain/markets/service';
import {
  getLatestInsight,
  saveInsight,
} from '@/domain/insights/service';
import { generateInsights } from '@/lib/ai';

vi.mock('@/domain/markets/service', () => ({
  fetchMarkets: vi.fn(),
  fetchMarketDetail: vi.fn(),
}));
vi.mock('@/domain/insights/service', () => ({
  getLatestInsight: vi.fn(),
  getInsightByDate: vi.fn(),
  saveInsight: vi.fn(),
}));
vi.mock('@/lib/ai', () => ({
  generateInsights: vi.fn(),
}));

const mockedFetchMarkets = vi.mocked(fetchMarkets);
const mockedFetchDetail = vi.mocked(fetchMarketDetail);
const mockedGetLatest = vi.mocked(getLatestInsight);
const mockedSave = vi.mocked(saveInsight);
const mockedGenerate = vi.mocked(generateInsights);

describe('GET /api/insights/[cadence]', () => {
  beforeEach(() => {
    mockedFetchMarkets.mockReset();
    mockedGetLatest.mockReset();
    mockedSave.mockReset();
    mockedGenerate.mockReset();
    vi.setSystemTime(new Date('2025-11-19T00:00:00Z'));
  });

  it('returns cached insight when fresh', async () => {
    mockedGetLatest.mockResolvedValue({
      dateKey: '2025-11-19',
      content: JSON.stringify({
        dateKey: '2025-11-19',
        generatedAt: new Date().toISOString(),
        model: 'qwen',
        cadence: 'daily',
        sections: [],
      }),
      topics: [],
      generatedAt: new Date().toISOString(),
      cadence: 'daily',
    });

    const response = await fetchInsights(
      new NextRequest('http://localhost/api/insights/daily'),
      { params: { cadence: 'daily' } }
    );
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockedFetchMarkets).not.toHaveBeenCalled();
  });

  it('generates new insight when cache is missing', async () => {
    mockedGetLatest.mockResolvedValue(null);
    mockedFetchMarkets.mockResolvedValue([]);
    mockedGenerate.mockResolvedValue({
      dateKey: '2025-11-19',
      generatedAt: new Date().toISOString(),
      model: 'qwen',
      cadence: 'daily',
      sections: [],
    });

    const response = await fetchInsights(
      new NextRequest('http://localhost/api/insights/daily'),
      { params: { cadence: 'daily' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.dateKey).toBe('2025-11-19');
    expect(mockedSave).toHaveBeenCalled();
  });

  it('handles AI failure', async () => {
    mockedGetLatest.mockResolvedValue(null);
    mockedFetchMarkets.mockResolvedValue([]);
    mockedGenerate.mockResolvedValue(null);

    const response = await fetchInsights(
      new NextRequest('http://localhost/api/insights/daily'),
      { params: { cadence: 'daily' } }
    );
    expect(response.status).toBe(502);
  });
});

describe('POST /api/insights/[cadence]/sections', () => {
  beforeEach(() => {
    mockedFetchDetail.mockReset();
    mockedGenerate.mockReset();
    mockedSave.mockReset();
    mockedGetLatest.mockReset();
  });

  it('regenerates a section', async () => {
    mockedGetLatest.mockResolvedValue({
      dateKey: '2025-11-19',
      content: JSON.stringify({
        dateKey: '2025-11-19',
        cadence: 'daily',
        generatedAt: new Date().toISOString(),
        model: 'qwen',
        sections: [
          {
            heading: 'Crypto',
            items: [{ title: 'BTC', summary: 'Old', topic: 'crypto', marketId: '1' }],
          },
        ],
      }),
      topics: [],
      generatedAt: new Date().toISOString(),
      cadence: 'daily',
    });
    mockedFetchDetail.mockResolvedValue({
      id: '1',
      title: 'BTC',
      category: 'Crypto',
      topics: ['crypto'],
      status: 'open',
      yesProbability: 0.5,
      yesPrice: 0.5,
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
    mockedGenerate.mockResolvedValue({
      dateKey: '2025-11-19',
      generatedAt: new Date().toISOString(),
      model: 'qwen',
      cadence: 'daily',
      sections: [
        {
          heading: 'Crypto',
          items: [{ title: 'BTC', summary: 'New summary', topic: 'crypto' }],
        },
      ],
    });

    const response = await regenerateSection(
      new NextRequest('http://localhost/api/insights/daily/sections', {
        method: 'POST',
        body: JSON.stringify({ sectionHeading: 'Crypto' }),
      }),
      { params: { cadence: 'daily' } }
    );

    expect(response.status).toBe(200);
    expect(mockedSave).toHaveBeenCalled();
  });
});
