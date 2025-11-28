export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { removeFromWatchlist } from '@/domain/markets/watchlist';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const handler = async (
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) => {
  const { marketId } = await params;
  if (request.method !== 'DELETE') {
    return failure('METHOD_NOT_ALLOWED', 'Unsupported method.', {
      status: 405,
    });
  }

  const walletAddress = readWalletAddress(request);
  if (!walletAddress) {
    return failure('INVALID_REQUEST', 'walletAddress header is required.', {
      status: 400,
    });
  }

  if (!marketId) {
    return failure('INVALID_REQUEST', 'marketId is required.', {
      status: 400,
    });
  }

  await removeFromWatchlist({ walletAddress, marketId });
  return success({ ok: true });
};

export const DELETE = withApiLogging(handler, {
  action: 'markets.watchlist.remove',
});

function readWalletAddress(request: NextRequest) {
  return (
    request.headers.get('x-wallet-address') ??
    request.headers.get('x-walletaddress') ??
    request.headers.get('x-wallet') ??
    undefined
  );
}
