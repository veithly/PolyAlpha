export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { listContributionReplies } from '@/domain/contributions/service';
import type { ContributionStatus } from '@/domain/types';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const handler = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const viewerWallet = searchParams.get('viewerWallet') ?? undefined;
  const limit = parseNumeric(searchParams.get('limit'));
  const cursor = searchParams.get('cursor') ?? undefined;
  const requestedStatuses = parseStatuses(searchParams.get('status'));

  if (!id) {
    return failure('INVALID_REQUEST', 'id is required', { status: 400 });
  }

  const result = await listContributionReplies(id, {
    statuses: requestedStatuses ?? undefined,
    limit: limit ?? undefined,
    cursor: cursor ?? undefined,
    viewerWallet,
  });
  return success(result);
};

export const GET = withApiLogging(handler, {
  action: 'contributions.replies.list',
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
