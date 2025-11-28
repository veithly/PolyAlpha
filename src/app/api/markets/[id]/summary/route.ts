export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { fetchMarketDetail } from '@/domain/markets/service';
import {
  getMarketSummaryCache,
  upsertMarketSummary,
} from '@/domain/marketSummaries/service';
import { summarizeMarket } from '@/lib/ai';
import { fetchNews } from '@/lib/news';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const SUMMARY_TTL_MS = 1000 * 60 * 60; // 60 minutes

type Params = {
  params: Promise<{
    id: string;
  }>;
};

const handler = async (request: NextRequest, { params }: Params) => {
  const { id: marketId } = await params;
  if (!marketId) {
    return failure('INVALID_REQUEST', 'Market id is required.', {
      status: 400,
    });
  }

  try {
    const force =
      request?.nextUrl?.searchParams?.get('force') === 'true';
    const cached = await getMarketSummaryCache(marketId);
    if (cached && !force && !isExpired(cached.generatedAt)) {
      return success(cached);
    }

    const detail = await fetchMarketDetail(marketId);
    if (!detail) {
      return failure('NOT_FOUND', 'Market not found.', { status: 404 });
    }

    const news = await fetchNews(detail.title, 6);

    const aiSummary = await summarizeMarket(detail, { news });

    // Fallback: if AI is unavailable, return a lightweight placeholder so UI stays functional.
    if (!aiSummary) {
      const placeholder = {
        marketId,
        summary:
          detail.description?.slice(0, 280) ??
          'AI summary temporarily unavailable. Check market details on Polymarket.',
        generatedAt: new Date().toISOString(),
        model: 'fallback',
        news: news ?? [],
      };
      return success(placeholder);
    }

    const stored = await upsertMarketSummary(aiSummary);
    return success(stored);
  } catch (error) {
    console.error('[api] market summary error', error);
    return failure(
      'SUMMARY_FAILED',
      'Unable to generate AI summary right now.',
      { status: 502 }
    );
  }
};

export const GET = withApiLogging(handler, { action: 'markets.summary' });

function isExpired(isoString: string) {
  const timestamp = new Date(isoString).getTime();
  return Number.isNaN(timestamp) || Date.now() - timestamp > SUMMARY_TTL_MS;
}
