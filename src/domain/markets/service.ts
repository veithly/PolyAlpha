import { MarketDetail, MarketSummary, Topic } from '../types';
import {
  fetchMarketDetailFromPolymarket,
  fetchMarketsFromPolymarket,
  getLastMarketFetchAt,
} from '../../lib/polymarket';
import {
  getCachedMarkets,
  getLatestMarketSnapshotAt,
  upsertMarketSnapshots,
} from './cache';
import {
  marketMatchesFilters,
  type MarketFilterOptions,
} from './filters';

export interface FetchMarketsOptions extends MarketFilterOptions {
  limit?: number;
  sort?: 'volume_24h' | 'change_24h' | 'hot';
  marketIds?: string[];
  fallbackCache?: boolean;
  cursor?: number;
}

export async function fetchMarkets(
  options: FetchMarketsOptions = {}
): Promise<MarketSummary[]> {
  const { items } = await fetchMarketsWithMeta(options);
  return items;
}

export async function fetchMarketDetail(
  marketId: string
): Promise<MarketDetail | null> {
  return fetchMarketDetailFromPolymarket(marketId);
}

export async function fetchMarketsWithMeta(
  options: FetchMarketsOptions = {}
): Promise<{
  items: MarketSummary[];
  cursor?: string;
  source: 'live' | 'cache' | 'none';
  lastUpdated: string | null;
}> {
  const cursorOffset = normalizeCursor(options.cursor);
  const limit = options.limit ?? 50;
  const marketsFromSource = await fetchMarketsFromPolymarket({
    ...options,
    cursor: cursorOffset,
    limit: Math.min(cursorOffset + limit + 1, 200),
  });
  const { items: filtered, cursor } = applyLocalFilters(marketsFromSource, {
    ...options,
    cursor: cursorOffset,
    limit,
  });

  if (marketsFromSource.length) {
    queueMicrotask(() => {
      upsertMarketSnapshots(marketsFromSource).catch((error) =>
        console.warn('[cache] failed to snapshot markets', error)
      );
    });
    const lastUpdated =
      filtered[0]?.updatedAt ??
      marketsFromSource[0]?.updatedAt ??
      getLastMarketFetchAt() ??
      new Date().toISOString();
    return { items: filtered, cursor, source: 'live', lastUpdated };
  }

  if (options.fallbackCache) {
    const cached = await getCachedMarkets({
      ...options,
      cursor: cursorOffset,
      limit: cursorOffset + limit + 1,
    });
    const { items, cursor } = applyLocalFilters(cached, {
      ...options,
      cursor: cursorOffset,
      limit,
    });
    const lastUpdated =
      cached[0]?.updatedAt ?? (await getLatestMarketSnapshotAt()) ?? null;
    return {
      items,
      cursor,
      source: cached.length ? 'cache' : 'none',
      lastUpdated,
    };
  }

  return { items: [], cursor: undefined, source: 'none', lastUpdated: null };
}

function applyLocalFilters(
  markets: MarketSummary[],
  options: FetchMarketsOptions
): { items: MarketSummary[]; cursor?: string } {
  const filtered = markets.filter((market) =>
    marketMatchesFilters(market, options)
  );
  const offset = normalizeCursor(options.cursor);
  const limit = options.limit ?? filtered.length;
  const paged = filtered.slice(offset, offset + limit);
  const nextCursor =
    filtered.length > offset + limit ? String(offset + limit) : undefined;
  return { items: paged, cursor: nextCursor };
}

function normalizeCursor(value: number | undefined) {
  if (typeof value !== 'number') return 0;
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}
