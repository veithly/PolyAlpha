import 'dotenv/config';

import type {
  AiInsight,
  InsightCadence,
  MarketSummary,
  Topic,
} from '@/domain/types';
import { upsertMarketSnapshots } from '@/domain/markets/cache';
import { fetchMarketsFromPolymarket, isTopic } from '@/lib/polymarket';
import { generateInsights, summarizeMarket } from '@/lib/ai';
import { saveInsight } from '@/domain/insights/service';
import { upsertMarketSummary } from '@/domain/marketSummaries/service';
import { prisma } from '@/lib/prisma';

async function main() {
  const markets = await fetchMarketsFromPolymarket({ limit: 20, sort: 'hot' });
  if (!markets.length) {
    console.warn('[jobs] fetched zero markets, exiting');
    return;
  }

  console.info(`[jobs] fetched ${markets.length} markets`);
  await upsertMarketSnapshots(markets);
  console.info('[jobs] market snapshots stored');

  await generateAndPersist('daily', markets.slice(0, 10));
  await generateAndPersist('hourly', markets.slice(0, 5));

  const summaryTargets = markets.slice(0, 5);
  for (const market of summaryTargets) {
    const summary = await summarizeMarket({
      ...market,
      priceSeries: [],
      volumeSeries: [],
    });
    if (summary) {
      await upsertMarketSummary(summary);
    }
  }
  console.info('[jobs] market summaries refreshed');
}

async function generateAndPersist(
  cadence: InsightCadence,
  markets: MarketSummary[]
) {
  const insight = await generateInsights(cadence, markets);
  if (!insight) {
    console.warn(`[jobs] ${cadence} insight generation returned null`);
    return;
  }

  await saveInsight({
    dateKey: insight.dateKey,
    content: JSON.stringify(insight),
    topics: collectTopics(insight),
    generatedAt: insight.generatedAt,
    cadence,
  });
  console.info(`[jobs] ${cadence} insight cached`);
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

main()
  .catch((error) => {
    console.error('[jobs] snapshot error', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
