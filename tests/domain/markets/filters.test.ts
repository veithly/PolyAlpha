import { describe, expect, it } from 'vitest';

import { marketMatchesFilters } from '@/domain/markets/filters';
import type { MarketSummary } from '@/domain/types';

const baseMarket: MarketSummary = {
  id: 'm1',
  title: 'Test market',
  category: 'crypto',
  topics: ['crypto'],
  status: 'open',
  yesProbability: 0.42,
  yesPrice: 0.42,
  change24h: 0.12,
  volume24h: 120000,
  totalVolume: 500000,
  liquidity: 75000,
  isHot: true,
  isSpike: false,
  polymarketUrl: 'https://polymarket.com',
  updatedAt: new Date().toISOString(),
};

describe('marketMatchesFilters', () => {
  it('respects volume min and max', () => {
    expect(
      marketMatchesFilters(baseMarket, {
        volume24hMin: 100000,
        volume24hMax: 130000,
      })
    ).toBe(true);

    expect(
      marketMatchesFilters(baseMarket, {
        volume24hMin: 130001,
      })
    ).toBe(false);

    expect(
      marketMatchesFilters(baseMarket, {
        volume24hMax: 50000,
      })
    ).toBe(false);
  });

  it('respects liquidity min and max', () => {
    expect(
      marketMatchesFilters(baseMarket, {
        liquidityMin: 50000,
        liquidityMax: 80000,
      })
    ).toBe(true);

    expect(
      marketMatchesFilters(baseMarket, {
        liquidityMax: 50000,
      })
    ).toBe(false);
  });

  it('respects change range', () => {
    expect(
      marketMatchesFilters(baseMarket, {
        change24hMin: 0.05,
        change24hMax: 0.2,
      })
    ).toBe(true);

    expect(
      marketMatchesFilters(baseMarket, {
        change24hMax: 0.05,
      })
    ).toBe(false);
  });

  it('matches any topic in stacked list', () => {
    expect(
      marketMatchesFilters(baseMarket, {
        topics: ['politics', 'crypto'],
      })
    ).toBe(true);
  });
});
