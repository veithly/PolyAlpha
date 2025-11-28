export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import {
  addToWatchlist,
  fetchWatchlistMarkets,
  listWatchlistIds,
} from '@/domain/markets/watchlist';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const handler = async (request: NextRequest) => {
  const walletAddress = readWalletAddress(request);
  if (!walletAddress) {
    return failure('INVALID_REQUEST', 'walletAddress header is required.', {
      status: 400,
    });
  }

  if (request.method === 'GET') {
    const [ids, markets] = await Promise.all([
      listWatchlistIds(walletAddress),
      fetchWatchlistMarkets(walletAddress),
    ]);
    return success({ ids, items: markets });
  }

  if (request.method === 'POST') {
    const payload = (await request.json().catch(() => null)) as
      | { marketId?: string }
      | null;
    if (!payload?.marketId) {
      return failure(
        'INVALID_REQUEST',
        'marketId is required in the payload.',
        { status: 400 }
      );
    }
    await addToWatchlist({
      walletAddress,
      marketId: payload.marketId,
    });
    return success({ ok: true });
  }

  return failure('METHOD_NOT_ALLOWED', 'Unsupported method.', {
    status: 405,
  });
};

export const GET = withApiLogging(handler, {
  action: 'markets.watchlist.list',
});
export const POST = withApiLogging(handler, {
  action: 'markets.watchlist.add',
});

function readWalletAddress(request: NextRequest) {
  return (
    request.headers.get('x-wallet-address') ??
    request.headers.get('x-walletaddress') ??
    request.headers.get('x-wallet') ??
    undefined
  );
}
