import { prisma } from '../../lib/prisma';
import type {
  AiInsightRecord,
  InsightCadence,
  Topic,
} from '../types';

export interface SaveInsightInput {
  dateKey: string;
  content: string;
  topics?: Topic[];
  generatedAt: string;
  cadence: InsightCadence;
}

export async function getInsightByDate(
  dateKey: string,
  cadence: InsightCadence
): Promise<AiInsightRecord | null> {
  const record = await prisma.aiInsight.findUnique({
    where: { cadence_dateKey: { cadence, dateKey } },
  });

  return record ? map(record) : null;
}

export async function getLatestInsight(
  cadence: InsightCadence
): Promise<AiInsightRecord | null> {
  const record = await prisma.aiInsight.findFirst({
    where: { cadence },
    orderBy: { generatedAt: 'desc' },
  });
  return record ? map(record) : null;
}

export async function saveInsight(
  input: SaveInsightInput
): Promise<AiInsightRecord> {
  const result = await prisma.aiInsight.upsert({
    where: {
      cadence_dateKey: { cadence: input.cadence, dateKey: input.dateKey },
    },
    update: {
      content: input.content,
      topics: JSON.stringify(input.topics ?? []),
      generatedAt: new Date(input.generatedAt),
      cadence: input.cadence,
    },
    create: {
      dateKey: input.dateKey,
      content: input.content,
      topics: JSON.stringify(input.topics ?? []),
      generatedAt: new Date(input.generatedAt),
      cadence: input.cadence,
    },
  });

  return map(result);
}

function map(record: {
  dateKey: string;
  content: string;
  topics: string | null;
  generatedAt: Date;
  cadence: string;
}): AiInsightRecord {
  return {
    dateKey: record.dateKey,
    content: record.content,
    topics: safeParseTopics(record.topics),
    generatedAt: record.generatedAt.toISOString(),
    cadence:
      record.cadence === 'daily' ||
      record.cadence === 'hourly' ||
      record.cadence === 'event'
        ? (record.cadence as InsightCadence)
        : 'daily',
  };
}

function safeParseTopics(serialized: string | null): Topic[] {
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) ? (parsed as Topic[]) : [];
  } catch {
    return [];
  }
}
