import { prisma } from '@/lib/prisma';
import type { MarketDetail, MarketSummary } from '../types';
import { fetchMarketDetailFromPolymarket } from '@/lib/polymarket';
import { getCachedMarketsByIds } from './cache';

export async function listWatchlistIds(
  walletAddress: string
): Promise<string[]> {
  const rows = await prisma.marketWatchlist.findMany({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: { marketId: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => row.marketId);
}

export async function fetchWatchlistMarkets(
  walletAddress: string
): Promise<MarketSummary[]> {
  const marketIds = await listWatchlistIds(walletAddress);
  if (!marketIds.length) return [];

  const cached = await getCachedMarketsByIds(marketIds);
  const cachedMap = new Map(cached.map((market) => [market.id, market]));

  const missingIds = marketIds.filter((id) => !cachedMap.has(id));
  if (missingIds.length) {
    const fetched = await Promise.all(
      missingIds.map(async (marketId) => {
        const detail = await fetchMarketDetailFromPolymarket(marketId);
        return detail ? mapDetailToSummary(detail) : null;
      })
    );
    fetched
      .filter((entry): entry is MarketSummary => Boolean(entry))
      .forEach((entry) => cachedMap.set(entry.id, entry));
  }

  return marketIds
    .map((id) => cachedMap.get(id))
    .filter((market): market is MarketSummary => Boolean(market));
}

export async function addToWatchlist(params: {
  walletAddress: string;
  marketId: string;
}) {
  const wallet = params.walletAddress.toLowerCase();
  await prisma.marketWatchlist.upsert({
    where: {
      walletAddress_marketId: {
        walletAddress: wallet,
        marketId: params.marketId,
      },
    },
    update: {},
    create: {
      walletAddress: wallet,
      marketId: params.marketId,
    },
  });
}

export async function removeFromWatchlist(params: {
  walletAddress: string;
  marketId: string;
}) {
  const wallet = params.walletAddress.toLowerCase();
  await prisma.marketWatchlist.deleteMany({
    where: {
      walletAddress: wallet,
      marketId: params.marketId,
    },
  });
}

function mapDetailToSummary(detail: MarketDetail): MarketSummary {
  return {
    id: detail.id,
    title: detail.title,
    category: detail.category,
    topics: detail.topics,
    status: detail.status,
    yesProbability: detail.yesProbability,
    yesPrice: detail.yesPrice,
    noPrice: detail.noPrice,
    change24h: detail.change24h,
    volume24h: detail.volume24h,
    totalVolume: detail.totalVolume,
    liquidity: detail.liquidity,
    isHot: detail.isHot,
    isSpike: detail.isSpike,
    polymarketUrl: detail.polymarketUrl,
    updatedAt: detail.updatedAt,
  };
}
