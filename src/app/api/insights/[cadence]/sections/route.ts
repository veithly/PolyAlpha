export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { fetchMarkets, fetchMarketDetail } from '@/domain/markets/service';
import { getLatestInsight, saveInsight } from '@/domain/insights/service';
import type {
  AiInsight,
  InsightCadence,
  MarketDetail,
  MarketSummary,
  Topic,
} from '@/domain/types';
import { generateInsights } from '@/lib/ai';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';
import { isTopic } from '@/lib/polymarket';

const handler = async (
  request: NextRequest,
  { params }: { params: Promise<{ cadence: string }> }
) => {
  const { cadence: cadenceParam } = await params;
  const cadence = normalizeCadence(cadenceParam);
  if (!cadence) {
    return failure('INVALID_CADENCE', 'Cadence must be daily, hourly, or event.', {
      status: 400,
    });
  }

  const payload = (await request.json().catch(() => null)) as
    | { sectionHeading?: string }
    | null;

  if (!payload?.sectionHeading) {
    return failure(
      'INVALID_REQUEST',
      'sectionHeading is required in payload.',
      { status: 400 }
    );
  }

  try {
    const cached = await getLatestInsight(cadence);
    if (!cached) {
      return failure('NOT_FOUND', 'No insight found to refresh.', {
        status: 404,
      });
    }

    const parsed = JSON.parse(cached.content) as AiInsight;
    const targetSection = parsed.sections.find(
      (section) => section.heading === payload.sectionHeading
    );
    const markets = await resolveMarketsForSection(targetSection);
    const regenerated = await generateInsights(cadence, markets, {
      focusHeading: payload.sectionHeading,
    });
    if (!regenerated) {
      return failure(
        'INSIGHT_FAILED',
        'Unable to regenerate section right now.',
        { status: 502 }
      );
    }

    const merged = mergeSection(parsed, regenerated, payload.sectionHeading);
    await saveInsight({
      dateKey: merged.dateKey,
      content: JSON.stringify(merged),
      topics: collectTopics(merged),
      generatedAt: merged.generatedAt,
      cadence,
    });

    const updatedSection = merged.sections.find(
      (section) => section.heading === payload.sectionHeading
    );
    return success({
      insight: merged,
      section: updatedSection,
    });
  } catch (error) {
    console.error('[api] insight section refresh error', error);
    return failure(
      'INSIGHT_FAILED',
      'Unable to regenerate section right now.',
      { status: 502 }
    );
  }
};

export const POST = withApiLogging(handler, {
  action: 'insights.section.regenerate',
});

function normalizeCadence(value?: string | null): InsightCadence | null {
  if (!value) return null;
  if (value === 'daily' || value === 'hourly' || value === 'event') return value;
  return null;
}

async function resolveMarketsForSection(
  section?: AiInsight['sections'][number]
): Promise<MarketSummary[]> {
  if (!section) {
    return fetchMarkets({ limit: 10, sort: 'hot' });
  }

  const marketIds = section.items
    .map((item) => item.marketId)
    .filter(Boolean) as string[];
  if (!marketIds.length) {
    return fetchMarkets({ limit: 10, sort: 'hot' });
  }

  const details = await Promise.all(
    marketIds.map(async (id) => {
      const detail = await fetchMarketDetail(id);
      return detail ?? null;
    })
  );

  const summaries = details
    .filter((detail): detail is MarketDetail => Boolean(detail))
    .map((detail) => detail);

  if (!summaries.length) {
    return fetchMarkets({ limit: 10, sort: 'hot' });
  }

  return summaries;
}

function mergeSection(
  original: AiInsight,
  regenerated: AiInsight,
  heading: string
): AiInsight {
  const replacement = regenerated.sections.find(
    (section) => section.heading === heading
  );
  if (!replacement) {
    return original;
  }

  return {
    ...original,
    generatedAt: regenerated.generatedAt,
    sections: original.sections.map((section) =>
      section.heading === heading ? replacement : section
    ),
  };
}

function collectTopics(insight: AiInsight) {
  const topics = new Set<Topic>();
  insight.sections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.topic && isTopic(item.topic)) {
        topics.add(item.topic);
      }
    });
  });
  return [...topics];
}
