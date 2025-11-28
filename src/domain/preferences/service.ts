import { prisma } from '../../lib/prisma';
import type {
  NotificationChannel,
  Topic,
  TopicWeight,
  UserPreferences,
} from '../types';

export interface UpsertPreferencesInput {
  walletAddress: string;
  topics: Topic[];
  notifyDaily: boolean;
  channels?: NotificationChannel[];
  topicWeights?: TopicWeight[];
  askLimit?: number | null;
  hotSubscription?: HotSubscription | null;
}

export async function getUserPreferences(
  walletAddress: string
): Promise<UserPreferences | null> {
  const record = await prisma.userPreference.findUnique({
    where: { walletAddress: normalizeWallet(walletAddress) },
  });

  return record ? map(record) : null;
}

export async function upsertUserPreferences(
  input: UpsertPreferencesInput
): Promise<UserPreferences> {
  const normalized = normalizeWallet(input.walletAddress);
  const channels = sanitizeChannels(input.channels);
  const result = await prisma.userPreference.upsert({
    where: { walletAddress: normalized },
    update: {
      topics: JSON.stringify(input.topics ?? []),
      notifyDaily: input.notifyDaily,
      channels: serializeChannels(channels, input.hotSubscription),
      topicWeights: input.topicWeights
        ? JSON.stringify(input.topicWeights)
        : null,
      askLimit: input.askLimit ?? null,
      updatedAt: new Date(),
    },
    create: {
      walletAddress: normalized,
      topics: JSON.stringify(input.topics ?? []),
      notifyDaily: input.notifyDaily,
      channels: serializeChannels(channels, input.hotSubscription),
      topicWeights: input.topicWeights
        ? JSON.stringify(input.topicWeights)
        : null,
      askLimit: input.askLimit ?? null,
    },
  });

  return map(result);
}

function map(record: {
  walletAddress: string;
  topics: string;
  notifyDaily: boolean;
  channels: string | null;
  topicWeights: string | null;
  askLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
}): UserPreferences {
  const parsedChannels = safeParseChannels(record.channels);
  return {
    walletAddress: record.walletAddress,
    topics: safeParseTopics(record.topics),
    notifyDaily: record.notifyDaily,
    channels: parsedChannels?.channels,
    subscriptions: parsedChannels?.hot,
    topicWeights: safeParseTopicWeights(record.topicWeights),
    askLimit: record.askLimit ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function safeParseTopics(serialized?: string): Topic[] {
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) ? (parsed as Topic[]) : [];
  } catch {
    return [];
  }
}

function safeParseChannels(
  serialized: string | null
): { channels?: NotificationChannel[]; hot?: HotSubscription } | undefined {
  if (!serialized) return undefined;
  try {
    const parsed = JSON.parse(serialized);
    if (Array.isArray(parsed)) {
      return {
        channels: sanitizeChannels(parsed),
      };
    }
    if (parsed && typeof parsed === 'object') {
      const channels = Array.isArray((parsed as any).channels)
        ? sanitizeChannels((parsed as any).channels)
        : undefined;
      const hot = (parsed as any).hot as HotSubscription | undefined;
      return { channels, hot };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function safeParseTopicWeights(
  serialized: string | null
): TopicWeight[] | undefined {
  if (!serialized) return undefined;
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return undefined;
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const topic = (entry as { topic?: Topic }).topic;
        const weight = Number((entry as { weight?: number }).weight);
        if (!topic || Number.isNaN(weight)) return null;
        return {
          topic,
          weight: Math.max(0, Math.min(1, weight)),
        } satisfies TopicWeight;
      })
      .filter((value): value is TopicWeight => Boolean(value));
  } catch {
    return undefined;
  }
}

function normalizeWallet(address: string) {
  return address.trim().toLowerCase();
}

export type HotSubscription = {
  cadence: "daily" | "hourly";
  topics?: Topic[];
};

function serializeChannels(
  channels?: NotificationChannel[] | null,
  hot?: HotSubscription | null
): string | null {
  if (!channels && !hot) return null;
  return JSON.stringify({
    channels: channels ?? [],
    ...(hot ? { hot } : {}),
  });
}

const ALLOWED_CHANNELS: NotificationChannel[] = [
  'email',
  'telegram',
  'none',
  'farcaster',
];

function sanitizeChannels(
  channels?: (NotificationChannel | string | null)[] | null
): NotificationChannel[] | undefined {
  if (!channels) return undefined;
  const seen = new Set<NotificationChannel>();
  for (const ch of channels) {
    if (!ch) continue;
    const normalized = String(ch).trim().toLowerCase();
    if ((ALLOWED_CHANNELS as string[]).includes(normalized)) {
      seen.add(normalized as NotificationChannel);
    }
  }
  return Array.from(seen);
}

export async function saveHotSubscription(
  walletAddress: string,
  subscription: HotSubscription
): Promise<UserPreferences> {
  const existing = await getUserPreferences(walletAddress);
  return upsertUserPreferences({
    walletAddress,
    topics: existing?.topics ?? [],
    notifyDaily: existing?.notifyDaily ?? false,
    channels: existing?.channels,
    topicWeights: existing?.topicWeights,
    askLimit: existing?.askLimit ?? null,
    hotSubscription: subscription,
  });
}
