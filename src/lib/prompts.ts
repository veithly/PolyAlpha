import type {
  InsightCadence,
  MarketDetail,
  MarketSummary,
  Topic,
} from '../domain/types';

export function buildInsightSystemPrompt(
  cadence: InsightCadence,
  focusHeading?: string
) {
  const cadenceLabel =
    cadence === 'hourly'
      ? 'hourly micro-movements'
      : cadence === 'event'
      ? 'event-driven catalysts'
      : 'daily macro trends';

  const focusCopy = focusHeading
    ? `Focus on refreshing the "${focusHeading}" section only while keeping other sections untouched.`
    : '';

  return `
You are an assistant helping Polymarket traders spot ${cadenceLabel}.
Group markets into 3-4 topical sections (Crypto, Politics, Macro, Other) unless focusing on a single section.
For each section include a "confidence" field between 0 and 1 reflecting AI certainty.
Every section item must provide title, summary, topic, and optionally marketId/marketTitle.
Respond with JSON:
{
  "sections": [
    {
      "heading": "",
      "confidence": 0.74,
      "items": [
        { "title": "", "summary": "", "topic": "", "marketId": "", "score": 0.6 }
      ]
    }
  ]
}
${focusCopy}
`;
}

export function buildInsightUserMessage(
  markets: MarketSummary[],
  focusHeading?: string
) {
  const focus = focusHeading
    ? `Regenerate only for heading "${focusHeading}".`
    : 'Return fresh insights for the provided markets.';

  return `${focus}
Markets JSON: ${JSON.stringify(markets.slice(0, 10))}`;
}

export function buildMarketSummaryPrompt(
  market: MarketDetail,
  newsItems?: { title: string; link: string }[]
) {
  const newsBlock =
    newsItems && newsItems.length
      ? `Recent headlines (most relevant first):\n${newsItems
          .map((n, i) => `${i + 1}. ${n.title} (${n.link})`)
          .join('\n')}\n`
      : 'No fresh headlines were fetched; rely on market data only.\n';

  return `You are an AI market writer crafting concise, news-like narratives for Polymarket users.
Summarize market "${market.title}" with current Yes probability ${
    market.yesProbability ?? '?'
  }.
Blend quantitative context (odds, 24h change, volume) with qualitative catalysts.
Tone: factual, neutral, 2-3 short paragraphs max, plus a one-line "Key takeaway".
${newsBlock}
Market JSON: ${JSON.stringify(market)}`;
}

type QaHistory = {
  question: string;
  answer: string;
};

export function buildAskPrompt(
  question: string,
  market: MarketDetail,
  history?: QaHistory[],
  contextNote?: string
) {
  const historyBlock = history?.length
    ? `Previous exchanges:\n${history
        .map(
          (entry, index) =>
            `${index + 1}. User: ${entry.question}\n   Assistant: ${entry.answer}`
        )
        .join('\n')}\n`
    : '';

  const contextBlock = contextNote ? `Additional page context: ${contextNote}\n` : '';

  return `${historyBlock}${contextBlock}Question: ${question}\nMarket Context: ${JSON.stringify(
    market
  )}`;
}
