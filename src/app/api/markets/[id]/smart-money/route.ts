export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';
import { fetchMarketDetailFromPolymarket } from '@/lib/polymarket';

export const dynamic = 'force-dynamic';

const handler = async (
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: marketId } = await params;
  if (!marketId) {
    return failure('INVALID_REQUEST', 'marketId is required', { status: 400 });
  }

  const detail = await fetchMarketDetailFromPolymarket(marketId);
  if (!detail) {
    return failure('NOT_FOUND', 'Market not found', { status: 404 });
  }

  // Approximate “smart money” using volume/liquidity momentum
  const inflow = Math.max(
    0,
    Math.round((detail.volume24h ?? 0) - (detail.totalVolume ?? 0) * 0.01)
  );
  const depthChange = detail.liquidity
    ? Math.round(((detail.volume24h ?? 0) / Math.max(detail.liquidity, 1)) * 5000)
    : 0;
  const whaleScore = Number(
    ((inflow / Math.max(detail.liquidity ?? 1, 1)) || 0).toFixed(2)
  );

  return success({
    marketId,
    inflowUsd: inflow,
    depthDeltaUsd: depthChange,
    whaleScore,
    updatedAt: new Date().toISOString(),
    note: "Heuristic based on 24h volume vs liquidity; replace with real smart money feed when available.",
  });
};

export const GET = withApiLogging(handler, { action: 'markets.smartMoney' });
