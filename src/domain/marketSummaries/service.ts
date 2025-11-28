import { prisma } from '../../lib/prisma';
import type { AiMarketSummary } from '../types';

export async function getMarketSummaryCache(
  marketId: string
): Promise<AiMarketSummary | null> {
  const record = await prisma.marketSummary.findUnique({
    where: { marketId },
  });
  return record ? map(record) : null;
}

export async function upsertMarketSummary(
  summary: AiMarketSummary
): Promise<AiMarketSummary> {
  const record = await prisma.marketSummary.upsert({
    where: { marketId: summary.marketId },
    update: {
      content: summary.summary,
      language: summary.language ?? 'en',
      modelName: summary.model ?? null,
      generatedAt: new Date(summary.generatedAt),
    },
    create: {
      marketId: summary.marketId,
      content: summary.summary,
      language: summary.language ?? 'en',
      modelName: summary.model ?? null,
      generatedAt: new Date(summary.generatedAt),
    },
  });

  return map(record);
}

function map(record: {
  marketId: string;
  content: string;
  language: string | null;
  modelName: string | null;
  generatedAt: Date;
}): AiMarketSummary {
  return {
    marketId: record.marketId,
    summary: record.content,
    language: record.language ?? 'en',
    model: record.modelName ?? 'unknown',
    generatedAt: record.generatedAt.toISOString(),
  };
}
