export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import {
  createContribution,
  listContributionsByMarket,
  listContributionsByWallet,
  ContributionValidationError,
} from '@/domain/contributions/service';
import type { ContributionStatus } from '@/domain/types';
import { hasSharedToken } from '@/lib/auth';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const getHandler = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const marketId = searchParams.get('marketId');
  const walletAddress = searchParams.get('walletAddress');
  const viewerWallet = searchParams.get('viewerWallet') ?? undefined;
  const limit = parseNumeric(searchParams.get('limit'));
  const cursor = searchParams.get('cursor') ?? undefined;
  const requestedStatuses = parseStatuses(searchParams.get('status'));
  const isAdmin = hasSharedToken(
    request,
    process.env.CONTRIBUTION_ADMIN_TOKEN
  );

  if (!marketId && !walletAddress) {
    return failure(
      'INVALID_REQUEST',
      'Provide either marketId or walletAddress.',
      { status: 400 }
    );
  }

  try {
    if (marketId) {
      const result = await listContributionsByMarket(marketId, {
        statuses: isAdmin ? requestedStatuses ?? undefined : undefined,
        limit: limit ?? undefined,
        cursor: cursor ?? undefined,
        viewerWallet,
      });
      return success(result);
    }

    const items = await listContributionsByWallet(walletAddress!, {
      viewerWallet,
    });
    return success({ items });
  } catch (error) {
    console.error('[api] contributions GET error', error);
    return failure(
      'CONTRIBUTIONS_FETCH_FAILED',
      'Unable to load contributions.',
      { status: 502 }
    );
  }
};

const postHandler = async (request: NextRequest) => {
  try {
    const payload = (await request.json()) as {
      walletAddress?: string;
      marketId?: string;
      content?: string;
      attachmentUrl?: string | null;
      parentId?: string | null;
    };

    if (!payload.walletAddress || !payload.marketId || !payload.content) {
      return failure(
        'INVALID_REQUEST',
        'walletAddress, marketId, and content are required.',
        { status: 400 }
      );
    }

    if (payload.content.length > 1200) {
      return failure(
        'CONTENT_TOO_LONG',
        'Content must be 1200 characters or fewer.',
        { status: 400 }
      );
    }

    const contribution = await createContribution({
      walletAddress: payload.walletAddress,
      marketId: payload.marketId,
      content: payload.content,
      attachmentUrl: payload.attachmentUrl,
      parentId: payload.parentId,
    });

    return success(contribution, { status: 201 });
  } catch (error) {
    if (error instanceof ContributionValidationError) {
      return failure(error.code, error.message, { status: 400 });
    }
    console.error('[api] contributions POST error', error);
    return failure(
      'CONTRIBUTION_CREATE_FAILED',
      'Unable to save contribution.',
      { status: 502 }
    );
  }
};

export const GET = withApiLogging(getHandler, { action: 'contributions.list' });
export const POST = withApiLogging(postHandler, {
  action: 'contributions.create',
});

function parseNumeric(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const STATUS_MAP: Record<string, ContributionStatus> = {
  pending: 'pending',
  approved: 'approved',
  hidden: 'hidden',
  flagged: 'flagged',
  rejected: 'rejected',
  needs_review: 'needs_review',
};

function parseStatuses(value: string | null): ContributionStatus[] | [] | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'all') {
    return [];
  }
  const statuses = normalized
    .split(',')
    .map((item) => STATUS_MAP[item.trim()])
    .filter(Boolean) as ContributionStatus[];
  return statuses.length ? Array.from(new Set(statuses)) : undefined;
}
