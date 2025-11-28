import type { MarketSummary, Topic } from '../types';

export interface MarketFilterOptions {
  topics?: Topic[];
  volume24hMin?: number;
  volume24hMax?: number;
  liquidityMin?: number;
  liquidityMax?: number;
  change24hMin?: number;
  change24hMax?: number;
  marketIds?: string[];
}

export function marketMatchesFilters(
  market: MarketSummary,
  options: MarketFilterOptions = {}
): boolean {
  if (
    Array.isArray(options.marketIds) &&
    options.marketIds.length &&
    !options.marketIds.includes(market.id)
  ) {
    return false;
  }
  if (
    options.topics?.length &&
    !market.topics.some((topic) => options.topics!.includes(topic))
  ) {
    return false;
  }

  if (
    typeof options.volume24hMin === 'number' &&
    (market.volume24h ?? 0) < options.volume24hMin
  ) {
    return false;
  }

  if (
    typeof options.volume24hMax === 'number' &&
    (market.volume24h ?? 0) > options.volume24hMax
  ) {
    return false;
  }

  if (
    typeof options.liquidityMin === 'number' &&
    (market.liquidity ?? 0) < options.liquidityMin
  ) {
    return false;
  }

  if (
    typeof options.liquidityMax === 'number' &&
    (market.liquidity ?? 0) > options.liquidityMax
  ) {
    return false;
  }

  if (
    typeof options.change24hMin === 'number' &&
    (market.change24h ?? 0) < options.change24hMin
  ) {
    return false;
  }

  if (
    typeof options.change24hMax === 'number' &&
    (market.change24h ?? 0) > options.change24hMax
  ) {
    return false;
  }

  return true;
}
