export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { fetchMarketsWithMeta } from '@/domain/markets/service';
import type { Topic } from '@/domain/types';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const handler = async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const limit = parseNumber(searchParams.get('limit'), 50, 1, 100);
    const sortParam = searchParams.get('sort');
    const topicsParam = searchParams.get('topics');
    const cursor = parseCursor(searchParams.get('cursor'));
    const volume24hMin = parsePositiveNumber(
      searchParams.get('volume24hMin')
    );
    const volume24hMax = parsePositiveNumber(
      searchParams.get('volume24hMax')
    );
    const liquidityMin = parsePositiveNumber(searchParams.get('liquidityMin'));
    const liquidityMax = parsePositiveNumber(searchParams.get('liquidityMax'));
    const change24hMin = parseChange(searchParams.get('change24hMin'));
    const change24hMax = parseChange(searchParams.get('change24hMax'));

    const topics = topicsParam
      ? topicsParam.split(',').map((topic) => topic.trim() as Topic)
      : undefined;

    const sort =
      sortParam === 'volume_24h' ||
      sortParam === 'change_24h' ||
      sortParam === 'hot'
        ? sortParam
        : undefined;

    const {
      items,
      source,
      lastUpdated,
      cursor: nextCursor,
    } = await fetchMarketsWithMeta({
      limit,
      sort,
      topics,
      cursor,
      volume24hMin,
      volume24hMax,
      liquidityMin,
      liquidityMax,
      change24hMin,
      change24hMax,
      fallbackCache: true,
    });

    return success({
      items,
      cursor: nextCursor,
      source,
      lastUpdated,
      asOf: lastUpdated,
    });
  } catch (error) {
    console.error('[api] /markets error', error);
    return failure(
      'MARKETS_FETCH_FAILED',
      'Unable to load markets right now. Please try again later.',
      { status: 502 }
    );
  }
};

export const GET = withApiLogging(handler, { action: 'markets.list' });

function parseNumber(
  value: string | null,
  fallback: number,
  min: number,
  max: number
) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parsePositiveNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return undefined;
  return parsed;
}

function parseChange(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return undefined;
  return Math.max(-1, Math.min(1, parsed));
}

function parseCursor(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.floor(parsed);
}
