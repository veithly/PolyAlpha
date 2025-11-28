export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { clearQaLogs, listQaLogs } from '@/domain/qa/service';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const handler = async (request: NextRequest) => {
  const wallet =
    request.headers.get('x-wallet-address') ??
    request.nextUrl.searchParams.get('walletAddress');

  if (!wallet) {
    return failure(
      'INVALID_REQUEST',
      'walletAddress header or query param is required.',
      { status: 400 }
    );
  }

  const marketId = request.nextUrl.searchParams.get('marketId') ?? undefined;
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : 5;

  const items = await listQaLogs({
    walletAddress: wallet,
    marketId,
    limit: Number.isNaN(limit) ? 5 : Math.min(Math.max(limit, 1), 20),
  });

  return success({ items });
};

export const GET = withApiLogging(handler, { action: 'ask.logs.list' });

const clearHandler = async (request: NextRequest) => {
  const wallet =
    request.headers.get('x-wallet-address') ??
    request.nextUrl.searchParams.get('walletAddress');

  if (!wallet) {
    return failure(
      'INVALID_REQUEST',
      'walletAddress header or query param is required.',
      { status: 400 }
    );
  }

  const marketId = request.nextUrl.searchParams.get('marketId') ?? undefined;
  const cleared = await clearQaLogs({ walletAddress: wallet, marketId });
  return success({ cleared });
};

export const DELETE = withApiLogging(clearHandler, {
  action: 'ask.logs.clear',
});
