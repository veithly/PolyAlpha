import { prisma } from '@/lib/prisma';
import type { MarketSummary, Topic } from '../types';
import type { FetchMarketsOptions } from './service';
import { marketMatchesFilters } from './filters';

function serializeTopics(topics: Topic[]) {
  return JSON.stringify(topics ?? []);
}

function deserializeTopics(value: string): Topic[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed as Topic[];
    }
  } catch {
    // ignore
  }
  return [];
}

export async function upsertMarketSnapshots(markets: MarketSummary[]) {
  if (!markets.length) return;

  try {
    await prisma.$transaction(
      markets.map((market) =>
        prisma.cachedMarket.upsert({
          where: { marketId: market.id },
          update: mapMarketToDb(market),
          create: mapMarketToDb(market),
        })
      )
    );
  } catch (error) {
    console.warn('[cache] skipped upsertMarketSnapshots due to db error', error);
  }
}

export async function getCachedMarkets(
  options: FetchMarketsOptions = {}
): Promise<MarketSummary[]> {
  const cursor = options.cursor ?? 0;
  const take = (options.limit ?? 50) + cursor + 1;
  let rows: Awaited<ReturnType<typeof prisma.cachedMarket.findMany>> = [];
  try {
    rows = await prisma.cachedMarket.findMany({
      where: options.marketIds
        ? { marketId: { in: options.marketIds } }
        : undefined,
      orderBy: { updatedAt: 'desc' },
      take,
    });
  } catch (error) {
    console.warn('[cache] getCachedMarkets fell back to empty due to db error', error);
    return [];
  }

  let markets = rows
    .map(mapRowToMarket)
    .filter((market) => marketMatchesFilters(market, options));

  if (options.sort === 'volume_24h') {
    markets.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  } else if (options.sort === 'change_24h') {
    markets.sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  } else if (options.sort === 'hot') {
    markets.sort((a, b) => Number(b.isHot) - Number(a.isHot));
  }

  return markets;
}

export async function getLatestMarketSnapshotAt(): Promise<string | null> {
  try {
    const row = await prisma.cachedMarket.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return row?.updatedAt ? row.updatedAt.toISOString() : null;
  } catch (error) {
    console.warn('[cache] getLatestMarketSnapshotAt returning null due to db error', error);
    return null;
  }
}

export async function getCachedMarketsByIds(ids: string[]) {
  if (!ids.length) return [];
  try {
    const rows = await prisma.cachedMarket.findMany({
      where: { marketId: { in: ids } },
    });
    return rows.map(mapRowToMarket);
  } catch (error) {
    console.warn('[cache] getCachedMarketsByIds returning empty due to db error', error);
    return [];
  }
}

function mapMarketToDb(market: MarketSummary) {
  const toNumberOrNull = (value: number | string | undefined | null) => {
    if (value === null || value === undefined) return null;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  };

  return {
    marketId: market.id,
    title: market.title,
    category: market.category,
    topics: serializeTopics(market.topics),
    status: market.status,
    yesProbability: market.yesProbability,
    yesPrice: market.yesPrice,
    change24h: market.change24h,
    volume24h: toNumberOrNull(market.volume24h) ?? 0,
    totalVolume: toNumberOrNull(market.totalVolume),
    liquidity: toNumberOrNull(market.liquidity),
    polymarketUrl: market.polymarketUrl,
    isHot: market.isHot,
    isSpike: market.isSpike,
  };
}

export function mapRowToMarket(row: {
  marketId: string;
  title: string;
  category: string;
  topics: string;
  status: string;
  yesProbability: number;
  yesPrice: number;
  change24h: number;
  volume24h: number;
  totalVolume: number | null;
  liquidity: number | null;
  polymarketUrl: string;
  isHot: boolean;
  isSpike: boolean;
  updatedAt: Date;
}): MarketSummary {
  return {
    id: row.marketId,
    title: row.title,
    category: row.category,
    topics: deserializeTopics(row.topics),
    status: row.status as MarketSummary['status'],
    yesProbability: row.yesProbability,
    yesPrice: row.yesPrice,
    noPrice: undefined,
    change24h: row.change24h,
    volume24h: row.volume24h,
    totalVolume: row.totalVolume ?? undefined,
    liquidity: row.liquidity ?? undefined,
    isHot: row.isHot,
    isSpike: row.isSpike,
    polymarketUrl: row.polymarketUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}
