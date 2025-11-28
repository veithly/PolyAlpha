export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { getRecentGuardrailLogs } from '@/domain/guardrails/service';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const handler = async (request: NextRequest) => {
  const search = request.nextUrl.searchParams;
  const limitParam = search.get('limit');
  const limit = limitParam ? Number(limitParam) : 50;
  if (Number.isNaN(limit) || limit <= 0 || limit > 200) {
    return failure('INVALID_REQUEST', 'limit must be 1-200', { status: 400 });
  }
  const rows = await getRecentGuardrailLogs(limit);
  return success({ items: rows });
};

export const GET = withApiLogging(handler, { action: 'guardrails.logs' });

