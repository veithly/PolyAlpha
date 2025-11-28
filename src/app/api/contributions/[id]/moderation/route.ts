export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { moderateContribution } from '@/domain/contributions/service';
import type { ContributionStatus } from '@/domain/types';
import { hasSharedToken } from '@/lib/auth';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const handler = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const isAuthorized = hasSharedToken(
    request,
    process.env.CONTRIBUTION_ADMIN_TOKEN
  );
  if (!isAuthorized) {
    return failure('UNAUTHORIZED', 'Admin token required.', { status: 401 });
  }

  let payload: { status?: string };
  try {
    payload = (await request.json()) as { status?: string };
  } catch {
    payload = {};
  }

  const status = normalizeStatus(payload.status);
  if (!status) {
    return failure(
      'INVALID_REQUEST',
      'status must be pending, approved, hidden, flagged, rejected, or needs_review.',
      { status: 400 }
    );
  }

  try {
    const updated = await moderateContribution(id, status, {
      actor:
        request.headers.get('x-admin-actor') ??
        request.headers.get('x-wallet-address') ??
        'admin',
      reason: (payload as any).reason,
    });
    if (!updated) {
      return failure('NOT_FOUND', 'Contribution not found.', { status: 404 });
    }
    return success(updated);
  } catch (error) {
    console.error('[api] contributions moderation error', error);
    return failure(
      'CONTRIBUTION_MODERATION_FAILED',
      'Unable to update contribution status.',
      { status: 502 }
    );
  }
};

export const POST = withApiLogging(handler, {
  action: 'contributions.moderate',
});

function normalizeStatus(value?: string): ContributionStatus | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'pending' ||
    normalized === 'approved' ||
    normalized === 'hidden' ||
    normalized === 'flagged' ||
    normalized === 'rejected' ||
    normalized === 'needs_review'
  ) {
    return normalized as ContributionStatus;
  }
  return null;
}
