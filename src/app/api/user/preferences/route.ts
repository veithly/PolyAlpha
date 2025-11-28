export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import {
  getUserPreferences,
  upsertUserPreferences,
} from '@/domain/preferences/service';
import type {
  NotificationChannel,
  Topic,
  TopicWeight,
} from '@/domain/types';
import { failure, success } from '@/lib/http';

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('walletAddress');
  if (!wallet) {
    return failure('INVALID_REQUEST', 'walletAddress is required.', {
      status: 400,
    });
  }

  try {
    const prefs = await getUserPreferences(wallet);
    const effective = prefs ?? buildDefaultPreferences(wallet);

    return success(effective);
  } catch (error) {
    console.error('[api] preferences GET error', error);
    return failure(
      'PREFERENCES_FETCH_FAILED',
      'Unable to load preferences.',
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      walletAddress?: string;
      topics?: Topic[];
      notifyDaily?: boolean;
      channels?: NotificationChannel[];
      topicWeights?: TopicWeight[];
      askLimit?: number;
    };

    if (!payload.walletAddress || !Array.isArray(payload.topics)) {
      return failure(
        'INVALID_REQUEST',
        'walletAddress and topics are required.',
        { status: 400 }
      );
    }

    const saved = await upsertUserPreferences({
      walletAddress: payload.walletAddress,
      topics: payload.topics,
      notifyDaily: Boolean(payload.notifyDaily),
      channels: payload.channels,
      topicWeights: payload.topicWeights,
      askLimit:
        typeof payload.askLimit === 'number' && payload.askLimit > 0
          ? Math.floor(payload.askLimit)
          : undefined,
    });

    return success(saved);
  } catch (error) {
    console.error('[api] preferences POST error', error);
    return failure(
      'PREFERENCES_SAVE_FAILED',
      'Unable to save preferences.',
      { status: 502 }
    );
  }
}

function buildDefaultPreferences(walletAddress: string) {
  const topics: Topic[] = ['crypto'];
  const weight = 1 / topics.length;
  const topicWeights: TopicWeight[] = topics.map((topic) => ({
    topic,
    weight,
  }));
  const now = new Date().toISOString();
  return {
    walletAddress,
    topics,
    notifyDaily: false,
    channels: [],
    topicWeights,
    askLimit: undefined,
    createdAt: now,
    updatedAt: now,
  };
}
