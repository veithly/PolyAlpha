export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';

import { fetchMarkets } from '@/domain/markets/service';
import {
  getInsightByDate,
  getLatestInsight,
  saveInsight,
} from '@/domain/insights/service';
import type { AiInsight, InsightCadence, Topic } from '@/domain/types';
import { generateInsights } from '@/lib/ai';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';
import { isTopic } from '@/lib/polymarket';

const CADENCE_TTL_MS: Record<InsightCadence, number> = {
  daily: 60 * 60 * 1000,
  hourly: 15 * 60 * 1000,
  event: 6 * 60 * 60 * 1000,
};

const MARKET_LIMIT: Record<InsightCadence, number> = {
  daily: 10,
  hourly: 6,
  event: 8,
};

const handler = async (
  request: NextRequest,
  { params }: { params: Promise<{ cadence: string }> }
) => {
  const { cadence: rawCadence } = await params;
  const cadence = normalizeCadence(rawCadence);
  if (!cadence) {
    return failure('INVALID_CADENCE', 'Cadence must be daily, hourly, or event.', {
      status: 400,
    });
  }

  const force = request.nextUrl.searchParams.get('force') === 'true';
  const dateKey = request.nextUrl.searchParams.get('dateKey');

  try {
    const existing = dateKey
      ? await getInsightByDate(dateKey, cadence)
      : await getLatestInsight(cadence);

    if (existing && !force && !isExpired(existing.generatedAt, cadence)) {
      return success(parseInsight(existing.content));
    }

    const markets = await fetchMarkets({
      limit: MARKET_LIMIT[cadence],
      sort: 'hot',
    });
    const aiResult = await generateInsights(cadence, markets);

    if (!aiResult) {
      if (existing) {
        // Fall back to the last cached insight instead of failing hard when the AI provider is unavailable.
        return success(parseInsight(existing.content));
      }
      return failure(
        'INSIGHT_FAILED',
        'Unable to generate insight right now.',
        { status: 502 }
      );
    }

    await saveInsight({
      dateKey: aiResult.dateKey,
      content: JSON.stringify(aiResult),
      topics: collectTopics(aiResult),
      generatedAt: aiResult.generatedAt,
      cadence,
    });

    return success(aiResult);
  } catch (error) {
    console.error('[api] insights error', error);
    return failure(
      'INSIGHT_FAILED',
      'Unable to generate insight right now.',
      { status: 502 }
    );
  }
};

export const GET = withApiLogging(handler, { action: 'insights.fetch' });

function normalizeCadence(value?: string | null): InsightCadence | null {
  if (!value) return null;
  if (value === 'daily' || value === 'hourly' || value === 'event') {
    return value;
  }
  return null;
}

function collectTopics(insight: AiInsight): Topic[] {
  const topics = new Set<Topic>();
  insight.sections.forEach((section) => {
    if (section.topic && isTopic(section.topic)) {
      topics.add(section.topic);
    }
    section.items.forEach((item) => {
      if (item.topic && isTopic(item.topic)) {
        topics.add(item.topic);
      }
    });
  });
  return [...topics];
}

function parseInsight(content: string): AiInsight {
  return JSON.parse(content) as AiInsight;
}

function isExpired(isoString: string, cadence: InsightCadence) {
  const timestamp = new Date(isoString).getTime();
  if (Number.isNaN(timestamp)) return true;
  const ttl = CADENCE_TTL_MS[cadence] ?? CADENCE_TTL_MS.daily;
  return Date.now() - timestamp > ttl;
}


