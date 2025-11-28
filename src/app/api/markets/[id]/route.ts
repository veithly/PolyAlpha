export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { fetchMarketDetail } from '@/domain/markets/service';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

const handler = async (_: NextRequest, { params }: Params) => {
  const { id: marketId } = await params;
  if (!marketId) {
    return failure('INVALID_REQUEST', 'Market id is required.', {
      status: 400,
    });
  }

  try {
    const detail = await fetchMarketDetail(marketId);
    if (!detail) {
      return failure('NOT_FOUND', 'Market not found.', { status: 404 });
    }

    return success(detail);
  } catch (error) {
    console.error('[api] market detail error', error);
    return failure(
      'MARKET_DETAIL_FAILED',
      'Unable to load market detail.',
      { status: 502 }
    );
  }
};

export const GET = withApiLogging(handler, { action: 'markets.detail' });
