export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { saveHotSubscription } from '@/domain/preferences/service';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

export const dynamic = 'force-dynamic';

type Body = {
  walletAddress?: string;
  cadence?: 'daily' | 'hourly';
  topics?: string[];
};

async function handler(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as Body;
  const wallet = payload.walletAddress?.trim().toLowerCase();
  if (!wallet) {
    return failure('INVALID_REQUEST', 'walletAddress is required.', {
      status: 400,
    });
  }
  const cadence = payload.cadence === 'hourly' ? 'hourly' : 'daily';
  try {
    const prefs = await saveHotSubscription(wallet, {
      cadence,
      topics: Array.isArray(payload.topics)
        ? payload.topics
            .map((t) => t?.toLowerCase?.())
            .filter((t): t is string => Boolean(t))
            .filter((t): t is import('@/domain/types').Topic =>
              t === 'crypto' ||
              t === 'politics' ||
              t === 'sports' ||
              t === 'meme' ||
              t === 'macro' ||
              t === 'other'
            )
        : undefined,
    });
    return success({ subscriptions: prefs.subscriptions });
  } catch (error) {
    console.error('[api] subscribe error', error);
    return failure('SUBSCRIBE_FAILED', 'Unable to save subscription.', {
      status: 500,
    });
  }
}

export const POST = withApiLogging(handler, { action: 'ai.subscribe' });
