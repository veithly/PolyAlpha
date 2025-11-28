import type { FetchMarketsOptions } from '../domain/markets/service';
import type {
  MarketDetail,
  MarketSummary,
  TimeSeriesPoint,
  Topic,
} from '../domain/types';

const PRIMARY_BASE = 'https://gamma-api.polymarket.com';
const ENV_BASE = process.env.POLYMARKET_API_BASE;

// Use Gamma as primary, optional env override as secondary. Drop clob fallback to avoid CORS/SSL failures.
const POLYMARKET_BASES = [
  PRIMARY_BASE,
  ...(ENV_BASE && ENV_BASE !== PRIMARY_BASE ? [ENV_BASE] : []),
];

const FETCH_TIMEOUT_MS = Number(process.env.POLYMARKET_TIMEOUT_MS ?? 6000);
const MAX_FETCH_ATTEMPTS = Math.max(
  1,
  Number(process.env.POLYMARKET_MAX_FETCH_ATTEMPTS ?? 2)
);
let lastMarketFetchAt: string | null = null;

const KNOWN_TOPICS: Topic[] = [
  'crypto',
  'politics',
  'sports',
  'meme',
  'macro',
  'other',
];

type PolymarketMarket = {
  id?: string;
  question_id?: string;
  condition_id?: string;
  market_slug?: string;
  question?: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: string;
  yesPrice?: number;
  noPrice?: number;
  recentYesPrice?: number;
  outcomes?: string[];
  outcomePrices?: number[];
  change24h?: number;
  volume24h?: number;
  volume?: number;
  liquidity?: number;
  url?: string;
  updatedAt?: string;
  createdTime?: string;
  createdAt?: string;
  end_date_iso?: string;
  endDate?: string;
  endDateIso?: string;
  game_start_time?: string;
  priceHistory?: PolymarketSeriesEntry[];
  volumeHistory?: PolymarketSeriesEntry[];
  priceSeries?: PolymarketSeriesEntry[];
  volumeSeries?: PolymarketSeriesEntry[];
  tokens?: { outcome?: string; price?: number; token_id?: string; tokenId?: string; id?: string }[];
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  clobTokenIds?: string[] | string;
};

type PolymarketSeriesEntry = {
  timestamp?: string | number;
  t?: string | number;
  ts?: string | number;
  time?: string | number;
  price?: number;
  p?: number;
  value?: number;
  yes?: number;
  probability?: number;
  volume?: number;
  amount?: number;
};

type MarketListResponse = {
  markets?: PolymarketMarket[];
  data?: PolymarketMarket[];
  events?: PolymarketMarket[];
};

type MarketDetailResponse =
  | { market?: PolymarketMarket; data?: PolymarketMarket[] }
  | PolymarketMarket
  | null;

type PublicSearchResponse = {
  tags?: { id?: string; slug?: string; label?: string }[];
};

const tagCache = new Map<Topic, string | null>();
const SERIES_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const CLOB_PRICE_INTERVAL = '1m';
const CLOB_PRICE_FIDELITY = Number(process.env.POLYMARKET_PRICE_FIDELITY ?? 60);
const CLOB_BASE = 'https://clob.polymarket.com';

function firstFinite(
  ...candidates: Array<number | string | null | undefined>
): number | undefined {
  for (const candidate of candidates) {
    const num =
      typeof candidate === 'number'
        ? candidate
        : typeof candidate === 'string'
          ? Number(candidate)
          : undefined;
    if (Number.isFinite(num)) return num as number;
  }
  return undefined;
}

function toTitleCase(value: string) {
  if (!value) return value;
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function computeSeriesChange(series: TimeSeriesPoint[]): number {
  if (!series.length) return 0;
  const now = Date.now();
  const window =
    series.filter((p) => {
      const ts = Date.parse(p.timestamp);
      return Number.isFinite(ts) && ts >= now - SERIES_LOOKBACK_MS;
    }) || [];
  const samples = window.length >= 2 ? window : series;
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last || !Number.isFinite(first.value) || !Number.isFinite(last.value)) {
    return 0;
  }
  if (Math.abs(first.value) < 1e-9) return 0;
  return (last.value - first.value) / first.value;
}

export async function fetchMarketsFromPolymarket(
  options: FetchMarketsOptions = {}
): Promise<MarketSummary[]> {
  const tagIds =
    options.topics && options.topics.length
      ? await resolveTagIdsForTopics(options.topics)
      : [];

  let markets: PolymarketMarket[] = [];

  if (tagIds.length) {
    for (const tagId of tagIds) {
      const tagged = await fetchMarketsByParams({
        tag_id: tagId,
        related_tags: 'true',
        limit: options.limit ? String(Math.max(options.limit, 50)) : '50',
        closed: 'false',
        archived: 'false',
        order: 'volume24hr',
        ascending: 'false',
        sort: options.sort ?? 'hot',
      });
      markets.push(...tagged);
    }
  }

  if (!markets.length) {
    const fallback = await fetchMarketsByParams({
      limit: options.limit ? String(options.limit) : '50',
      closed: 'false',
      archived: 'false',
      order: options.sort === 'change_24h' ? 'change24h' : 'volume24hr',
      ascending: 'false',
      sort: options.sort ?? 'hot',
    });
    markets.push(...fallback);
  }

  if (!markets.length) return [];

  const deduped = dedupeMarketsById(markets);
  const maxNeeded = Math.min(
    (options.limit ?? 50) + (options.cursor ?? 0) + 1,
    200
  );

  const prepared = deduped
    .filter(isMarketOpen)
    .slice(0, maxNeeded)
    .map(normalizeMarket)
    .filter((m): m is MarketSummary => Boolean(m));

  return prepared.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
}

async function resolveTagIdsForTopics(topics: Topic[]): Promise<string[]> {
  const ids: string[] = [];
  for (const topic of topics) {
    if (tagCache.has(topic)) {
      const cached = tagCache.get(topic);
      if (cached) ids.push(cached);
      continue;
    }
    const url = buildUrlWithBase(POLYMARKET_BASES[0], '/public-search', {
      q: topic,
      search_tags: 'true',
      limit_per_type: '5',
      cache: 'true',
    });
    const payload = await fetchJson<PublicSearchResponse>(url, 300, FETCH_TIMEOUT_MS);
    const match =
      payload?.tags?.find((tag) =>
        (tag.slug ?? tag.label ?? '').toLowerCase().includes(topic.toLowerCase())
      ) ?? payload?.tags?.[0];
    const id = match?.id ? String(match.id) : null;
    tagCache.set(topic, id);
    if (id) {
      ids.push(id);
    }
  }
  return ids;
}

async function fetchMarketsByParams(
  searchParams: Record<string, string | undefined>
): Promise<PolymarketMarket[]> {
  for (const base of POLYMARKET_BASES) {
    const paths = ['/markets', '/events'];
    for (const path of paths) {
      const url = buildUrlWithBase(base, path, searchParams);
      const payload = await fetchJson<MarketListResponse | PolymarketMarket[] | null>(url, 60, FETCH_TIMEOUT_MS);
      const parsed = normalizeMarketListPayload(payload);
      if (parsed.length) {
        return parsed;
      }
    }
  }
  console.warn('[polymarket] no markets returned from gamma bases');
  return [];
}

function dedupeMarketsById(entries: PolymarketMarket[]): PolymarketMarket[] {
  const seen = new Set<string>();
  const result: PolymarketMarket[] = [];
  for (const entry of entries) {
    const id = entry.id ?? entry.question_id ?? entry.market_slug ?? entry.condition_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(entry);
  }
  return result;
}

export async function fetchMarketDetailFromPolymarket(
  marketId: string
): Promise<MarketDetail | null> {
  if (!marketId) {
    return null;
  }

  let marketData: PolymarketMarket | null = null;

  for (const base of POLYMARKET_BASES) {
    const url = buildUrlWithBase(base, `/markets/${marketId}`);
    const payload = await fetchJson<MarketDetailResponse>(url, 30, FETCH_TIMEOUT_MS);

    const candidate =
      (payload && typeof payload === 'object' && 'market' in payload
        ? (payload as any).market
        : payload && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as any).data)
          ? (payload as any).data[0]
          : payload && typeof payload === 'object' && 'events' in payload && Array.isArray((payload as any).events)
            ? (payload as any).events[0]
            : payload) ?? null;

    if (candidate) {
      marketData = candidate as PolymarketMarket;
      break;
    }
  }

  if (!marketData || typeof marketData !== 'object' || !isMarketOpen(marketData as PolymarketMarket)) {
    return null;
  }

  const summary = normalizeMarket(marketData as PolymarketMarket);
  if (!summary) return null;

  const market = marketData as PolymarketMarket;
  const priceSeries = market.priceSeries ?? market.priceHistory ?? ([] as PolymarketSeriesEntry[]);
  const volumeSeries = market.volumeSeries ?? market.volumeHistory ?? ([] as PolymarketSeriesEntry[]);
  const normalizedPriceSeries = normalizeSeries(priceSeries, 'price');

  const shouldBackfillSeries = isSeriesTooShort(normalizedPriceSeries);
  const clobSeries = shouldBackfillSeries
    ? await fetchPriceHistoryFromClob(market)
    : [];
  const mergedPriceSeries = mergeSeries(normalizedPriceSeries, clobSeries);

  return {
    ...summary,
    description: market.description,
    createdAt: market.createdAt ?? market.createdTime ?? summary.updatedAt,
    priceSeries: mergedPriceSeries,
    volumeSeries: normalizeSeries(volumeSeries, 'volume'),
  };
}

function buildUrlWithBase(
  base: string,
  path: string,
  searchParams: Record<string, string | undefined> = {}
): URL {
  const url = new URL(path, base);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

function buildUrl(
  path: string,
  searchParams: Record<string, string | undefined> = {}
): URL {
  return buildUrlWithBase(POLYMARKET_BASES[0], path, searchParams);
}

async function fetchJson<T>(
  url: URL,
  revalidateSeconds = 60,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<T | null> {
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    try {
      const response = await fetch(url.toString(), {
        cache: 'no-store',
        next: { revalidate: 0 },
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PolyAlpha/1.0)',
          Accept: 'application/json',
        },
        signal: controller?.signal,
      });
      if (timer) clearTimeout(timer);
      if (!response.ok) {
        console.warn(
          `[polymarket] request failed (${attempt}/${MAX_FETCH_ATTEMPTS}) ${url.toString()} status=${response.status}`
        );
      } else {
        lastMarketFetchAt = new Date().toISOString();
        return (await response.json()) as T;
      }
    } catch (error) {
      if (timer) clearTimeout(timer);
      console.warn(
        `[polymarket] request error (${attempt}/${MAX_FETCH_ATTEMPTS}) ${url.toString()} timeout=${timeoutMs}ms`,
        error
      );
    }
    // small backoff before next attempt
    if (attempt < MAX_FETCH_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
  return null;
}

export function getLastMarketFetchAt() {
  return lastMarketFetchAt;
}

function normalizeMarketListPayload(payload: MarketListResponse | PolymarketMarket[] | null): PolymarketMarket[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return flattenEvents(payload as any[]);

  const candidates = payload.events ?? payload.markets ?? payload.data ?? [];
  if (Array.isArray(candidates)) return flattenEvents(candidates);
  return [];
}

function flattenEvents(entries: any[]): PolymarketMarket[] {
  const results: PolymarketMarket[] = [];

  for (const entry of entries) {
    if (!entry) continue;
    // Gamma returns events with nested markets; prefer the child markets and inherit tags/category/title.
    if (Array.isArray(entry.markets) && entry.markets.length) {
      for (const m of entry.markets) {
        results.push({
          ...entry,
          ...m,
          volume24h: (m as any).volume24h ?? (m as any).volume24hr ?? (entry as any).volume24hr ?? (entry as any).volume24h,
          question: m.question ?? entry.title ?? entry.question,
          category: m.category ?? entry.category,
          tags: m.tags ?? entry.tags,
          outcomePrices: m.outcomePrices ?? entry.outcomePrices,
          outcomes: m.outcomes ?? entry.outcomes,
          endDateIso: m.endDateIso ?? entry.endDateIso ?? entry.endDate ?? entry.end_date_iso,
          endDate: m.endDate ?? entry.endDate,
          end_date_iso: m.end_date_iso ?? entry.end_date_iso,
          updatedAt: m.updatedAt ?? entry.updatedAt ?? (entry as any).updated_at,
        });
      }
      continue;
    }

    results.push(entry as PolymarketMarket);
  }

  return results;
}

function normalizeMarket(entry: PolymarketMarket): MarketSummary | null {
  const toNumber = (value: any, fallback = 0) => {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const id = entry.id ?? entry.question_id ?? entry.condition_id ?? entry.market_slug ?? 'unknown';
  const topics = normalizeTopics(
    entry.tags,
    entry.category,
    entry.question,
    (entry as any).title
  );

  const parsedOutcomes =
    typeof entry.outcomes === 'string'
      ? (JSON.parse(entry.outcomes) as string[])
      : entry.outcomes ?? [];
  const parsedOutcomePrices =
    typeof entry.outcomePrices === 'string'
      ? (JSON.parse(entry.outcomePrices) as (number | string)[]).map((v) => Number(v))
      : entry.outcomePrices ?? [];

  const tokenYes = entry.tokens?.find((t) =>
    typeof t.outcome === 'string' ? /yes|up|over|winner/i.test(t.outcome) : false
  ) ?? entry.tokens?.[0];
  const tokenNo = entry.tokens?.find((t) =>
    typeof t.outcome === 'string' ? /no|under/i.test(t.outcome) : false
  ) ?? entry.tokens?.[1];

  const priceFromOutcomes = parsedOutcomePrices.length
    ? parsedOutcomePrices[0]
    : undefined;
  const priceFromOutcomesNo = parsedOutcomePrices.length > 1 ? parsedOutcomePrices[1] : undefined;

  const inferredYes =
    firstFinite(
      entry.yesPrice,
      entry.recentYesPrice,
      (entry as any).probability,
      (entry as any).lastPrice,
      priceFromOutcomes,
      tokenYes?.price,
      typeof tokenNo?.price === 'number' ? 1 - tokenNo.price : undefined,
      typeof priceFromOutcomesNo === 'number' ? 1 - priceFromOutcomesNo : undefined
    ) ?? 0.5;

  const status: MarketSummary['status'] = 'open';

  const endDate =
    entry.endDateIso ??
    entry.end_date_iso ??
    entry.endDate ??
    entry.end_date_iso ??
    undefined;

  const normalizedPriceSeries = normalizeSeries(
    entry.priceSeries ?? entry.priceHistory ?? ([] as PolymarketSeriesEntry[]),
    'price'
  );

  const change24h =
    firstFinite(
      entry.change24h,
      (entry as any).change_24h,
      (entry as any).change24hr,
      (entry as any).priceChange24h,
      (entry as any).price_change_24h,
      (entry as any).price_change_24hr
    ) ?? computeSeriesChange(normalizedPriceSeries);

  const categoryLabel =
    entry.category ??
    (typeof entry.tags?.[0] === 'string' ? entry.tags[0] : undefined) ??
    (topics.length ? toTitleCase(String(topics[0])) : 'Other');

  return {
    id,
    title: entry.question ?? 'Unknown market',
    category: categoryLabel,
    topics: topics.length ? topics : ['other'],
    status,
    yesProbability: clamp01(inferredYes),
    yesPrice: clamp01(inferredYes),
    noPrice:
      typeof tokenNo?.price === 'number'
        ? clamp01(tokenNo.price)
        : typeof priceFromOutcomesNo === 'number'
          ? clamp01(priceFromOutcomesNo)
          : undefined,
    change24h: change24h ?? 0,
    volume24h: toNumber(entry.volume24h ?? (entry as any).volume24hr ?? entry.volume, 0),
    totalVolume: toNumber(entry.volume, undefined as any),
    liquidity: toNumber(entry.liquidity, undefined as any),
    isHot: Boolean(toNumber(entry.volume24h ?? entry.volume ?? 0) > 5_000),
    isSpike: Boolean(change24h && Math.abs(change24h) > 0.1),
    polymarketUrl:
      entry.url ?? `https://polymarket.com/event/${entry?.market_slug ?? id ?? ''}`,
    updatedAt: entry.updatedAt ?? entry.createdAt ?? entry.createdTime ?? new Date().toISOString(),
    endDate: endDate ? new Date(endDate).toISOString() : undefined,
  };
}

function normalizeTopics(
  values?: any[],
  category?: string,
  question?: string,
  title?: string
): Topic[] {
  const buckets = new Set<Topic>();
  const tagStrings = (values ?? []).map((v: any) => {
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (v && typeof v === 'object') return v.label ?? v.slug ?? v.name ?? '';
    return '';
  });
  const candidates = [...tagStrings, category ?? '', question ?? '', title ?? '']
    .map((v) => v?.toLowerCase?.() ?? '')
    .filter(Boolean);

  const pushIf = (cond: boolean, t: Topic) => cond && buckets.add(t);

  candidates.forEach((tag) => {
    pushIf(/crypto|btc|eth|sol|token|chain|defi/.test(tag), 'crypto');
    pushIf(/politic|election|congress|senate|president|gop|democrat|trump|biden/.test(tag), 'politics');
    pushIf(/nba|nfl|mlb|nhl|ncaa|soccer|fifa|sports|game|match|ufc|tennis|cowboys|patriots|lakers|warriors|mavs|mavericks/.test(tag), 'sports');
    pushIf(/meme|viral|tiktok|celebrity|oscars|movie|show|spotify|artist|album|song|music|grammy|billboard|bruno mars|ed sheeran|billie eilish/.test(tag), 'meme');
    pushIf(/inflation|rate|gdp|macro|cpi|fed|oil|commod|econom|stock|share|equity|market cap|company|largest|second-largest|tesla|tsla|apple|aapl|amazon|amzn|google|googl|microsoft|msft|oracle|orcl|aramco|meta|fb|nvda|nvidia/.test(tag), 'macro');
    pushIf(/war|ceasefire|conflict|russia|ukraine|israel|gaza|hamas|peace deal|cease-fire/.test(tag), 'politics');
  });

  if (!buckets.size) return [];
  return Array.from(buckets);
}

export function isTopic(value: string): value is Topic {
  return KNOWN_TOPICS.includes(value as Topic);
}

function normalizeSeries(
  entries: PolymarketSeriesEntry[] = [],
  type: 'price' | 'volume' = 'price'
): TimeSeriesPoint[] {
  if (!entries.length) {
    return [];
  }

  return entries
    .map((entry) => {
      const timestamp = toIsoTimestamp(entry.timestamp ?? entry.t ?? entry.ts ?? entry.time);
      const rawValue =
        type === 'price'
          ? entry.price ??
            (entry as any).p ??
            entry.value ??
            entry.yes ??
            entry.probability ??
            null
          : entry.volume ?? entry.amount ?? entry.value ?? null;

      if (rawValue == null) {
        return null;
      }

      return {
        timestamp,
        value: rawValue,
      };
    })
    .filter(Boolean) as TimeSeriesPoint[];
}

function mergeSeries(...series: TimeSeriesPoint[][]): TimeSeriesPoint[] {
  if (!series.length) return [];
  const map = new Map<string, TimeSeriesPoint>();

  series
    .flat()
    .filter((point) => point && Number.isFinite(point.value))
    .forEach((point) => {
      const ts = toIsoTimestamp(point.timestamp);
      map.set(ts, { timestamp: ts, value: point.value });
    });

  return Array.from(map.entries())
    .sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]))
    .map(([, point]) => point);
}

function isSeriesTooShort(series: TimeSeriesPoint[]): boolean {
  if (!series.length) return true;
  const first = series[0];
  const last = series[series.length - 1];
  const spanMs = Date.parse(last.timestamp) - Date.parse(first.timestamp);
  const minSpanMs = 3 * 24 * 60 * 60 * 1000;
  return series.length < 10 || !Number.isFinite(spanMs) || spanMs < minSpanMs;
}

async function fetchPriceHistoryFromClob(market: PolymarketMarket): Promise<TimeSeriesPoint[]> {
  const tokenId = selectYesTokenId(market);
  if (!tokenId) return [];

  const url = new URL('/prices-history', CLOB_BASE);
  url.searchParams.set('market', tokenId);
  url.searchParams.set('interval', CLOB_PRICE_INTERVAL);
  url.searchParams.set('fidelity', String(Math.max(CLOB_PRICE_FIDELITY, 10)));

  const payload = await fetchJson<{ history?: { t?: number | string; p?: number | string }[] | null }>(
    url,
    60,
    Math.max(FETCH_TIMEOUT_MS, 10000)
  );

  const history = payload?.history ?? [];
  if (!Array.isArray(history) || !history.length) return [];

  return history
    .map((entry) => {
      const value = typeof entry.p === 'number' ? entry.p : Number(entry.p ?? NaN);
      if (!Number.isFinite(value)) return null;
      return {
        timestamp: toIsoTimestamp(entry.t),
        value,
      } as TimeSeriesPoint;
    })
    .filter(Boolean) as TimeSeriesPoint[];
}

function selectYesTokenId(market: PolymarketMarket): string | null {
  const parsedClobIds = parseTokenIds(market.clobTokenIds);
  const yesTokenFromTokens = market.tokens?.find((t) =>
    typeof t.outcome === 'string' ? /yes|up|over|winner/i.test(t.outcome) : false
  );

  const tokenIdCandidate =
    yesTokenFromTokens?.token_id ??
    yesTokenFromTokens?.tokenId ??
    yesTokenFromTokens?.id ??
    parsedClobIds[0] ??
    market.tokens?.[0]?.token_id ??
    market.tokens?.[0]?.tokenId ??
    market.tokens?.[0]?.id ??
    null;

  return tokenIdCandidate ? String(tokenIdCandidate) : null;
}

function parseTokenIds(value: PolymarketMarket['clobTokenIds']): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
      // fall through
    }
    return [value];
  }
  return [];
}

function toIsoTimestamp(value?: string | number): string {
  if (typeof value === 'number') {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function isMarketOpen(entry: PolymarketMarket) {
  const endDateStr = entry.endDateIso ?? entry.end_date_iso ?? entry.endDate;
  const endDate = endDateStr ? Date.parse(endDateStr) : undefined;
  const now = Date.now();
  // Require a valid future (or very recent) end date; otherwise treat as stale.
  const isStale =
    endDate == null || Number.isNaN(endDate)
      ? true
      : endDate < now - 12 * 60 * 60 * 1000; // drop events that ended >12h ago

  const updatedAt = entry.updatedAt ?? entry.createdAt ?? entry.createdTime;
  const isVeryOld =
    updatedAt && !Number.isNaN(Date.parse(updatedAt))
      ? Date.parse(updatedAt) < now - 7 * 24 * 60 * 60 * 1000
      : false;
  return !entry.closed && entry.active !== false && !entry.archived && !isStale && !isVeryOld;
}
