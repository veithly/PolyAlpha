export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import {
  removeContributionUpvote,
  upvoteContribution,
} from '@/domain/contributions/service';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

type WalletPayload = {
  walletAddress?: string;
};

const postHandler = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const walletAddress = await readWalletAddress(request);
  if (!walletAddress) {
    return failure('INVALID_REQUEST', 'walletAddress is required.', {
      status: 400,
    });
  }

  try {
    const updated = await upvoteContribution(id, walletAddress);
    if (!updated) {
      return failure('NOT_FOUND', 'Contribution not found.', { status: 404 });
    }
    return success(updated);
  } catch (error) {
    console.error('[api] contributions upvote error', error);
    return failure(
      'CONTRIBUTION_UPVOTE_FAILED',
      'Unable to register upvote.',
      { status: 502 }
    );
  }
};

const deleteHandler = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const walletAddress = await readWalletAddress(request);
  if (!walletAddress) {
    return failure('INVALID_REQUEST', 'walletAddress is required.', {
      status: 400,
    });
  }

  try {
    const updated = await removeContributionUpvote(id, walletAddress);
    if (!updated) {
      return failure('NOT_FOUND', 'Contribution not found.', { status: 404 });
    }
    return success(updated);
  } catch (error) {
    console.error('[api] contributions remove upvote error', error);
    return failure(
      'CONTRIBUTION_UPVOTE_FAILED',
      'Unable to remove upvote.',
      { status: 502 }
    );
  }
};

export const POST = withApiLogging(postHandler, {
  action: 'contributions.upvote',
});
export const DELETE = withApiLogging(deleteHandler, {
  action: 'contributions.removeUpvote',
});

async function readWalletAddress(request: NextRequest) {
  try {
    const payload = (await request.json()) as WalletPayload;
    return payload.walletAddress?.trim();
  } catch {
    return undefined;
  }
}
