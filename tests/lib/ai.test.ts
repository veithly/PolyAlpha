import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateInsights, summarizeMarket, askAiQuestion } from '@/lib/ai';

const originalEnv = { ...process.env };

describe('FLock AI helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.FLOCK_API_KEY = 'test-key';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-19T00:00:00Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('generates cadence insights and parses JSON payload', async () => {
    mockFetchResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              sections: [{ heading: 'Crypto', items: [] }],
            }),
          },
        },
      ],
    });

    const result = await generateInsights('daily', [
      {
        id: '1',
        title: 'Test',
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
      },
    ]);

    expect(result?.sections[0].heading).toBe('Crypto');
  });

  it('falls back when AI returns plain text', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'plain text' } }],
    });

    const result = await generateInsights('daily', []);
    expect(result?.sections[0].items[0].summary).toBe('plain text');
  });

  it('summarizes market', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'Summary text' } }],
    });

    const result = await summarizeMarket({
      id: '1',
      title: 'Test',
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

    expect(result?.summary).toBe('Summary text');
  });

  it('handles missing API key gracefully', async () => {
    process.env.FLOCK_API_KEY = '';
    const result = await summarizeMarket({
      id: '1',
      title: 'Test',
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
    expect(result).toBeNull();
  });

  it('supports ask AI questions', async () => {
    process.env.FLOCK_API_KEY = 'test-key';
    mockFetchResponse({
      choices: [{ message: { content: 'Answer' } }],
    });

    const output = await askAiQuestion({
      question: 'Why?',
      market: {
        id: '1',
        title: 'Test',
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
      },
    });
    expect(output).toBe('Answer');
  });

  it('sends the x-litellm-api-key header for chat completions endpoint', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'Summary text' } }],
    });

    await summarizeMarket({
      id: '1',
      title: 'Test',
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

    const [, requestInit] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
    expect(requestInit?.headers).toMatchObject({
      'x-litellm-api-key': 'test-key',
    });
  });

  it('falls back to x-api-key header for conversational endpoints', async () => {
    process.env.FLOCK_API_URL =
      'https://rag-chat-ml-backend-prod.flock.io/chat/conversational_rag_chat';
    mockFetchResponse({
      choices: [{ message: { content: 'Answer' } }],
    });

    await askAiQuestion({
      question: 'Test',
      market: {
        id: '1',
        title: 'Test',
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
      },
    });

    const [, requestInit] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
    expect(requestInit?.headers).toMatchObject({
      'x-api-key': 'test-key',
    });
  });
});

function mockFetchResponse(json: unknown) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => json,
  } as Response);
}
