import WebSocket from "ws";

type Subscription = {
  marketId: string;
  onData: (payload: any) => void;
};

const WS_URL =
  process.env.POLYMARKET_WS_URL ??
  "wss://ws-live-data.polymarket.com"; // RTDS, preferred

let socket: WebSocket | null = null;
const subscribers = new Map<string, Set<(p: any) => void>>();

function ensureSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) return;
  socket = new WebSocket(WS_URL);
  socket.on("open", () => {
    console.info("[ws] connected", WS_URL);
    // re-subscribe
    for (const marketId of subscribers.keys()) {
      sendSubscribe(marketId);
    }
  });
  socket.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const marketId = msg?.market_id ?? msg?.marketId ?? msg?.condition_id;
      if (marketId && subscribers.has(marketId)) {
        subscribers.get(marketId)?.forEach((cb) => cb(msg));
      }
    } catch (err) {
      console.warn("[ws] parse error", err);
    }
  });
  socket.on("close", () => {
    console.warn("[ws] closed, retrying in 2s");
    setTimeout(ensureSocket, 2000);
  });
  socket.on("error", (err) => {
    console.warn("[ws] error", err);
  });
}

function sendSubscribe(marketId: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const payload = {
    type: "market",
    channel: "trades",
    market_id: marketId,
  };
  socket.send(JSON.stringify(payload));
}

export function subscribeMarketTrades({
  marketId,
  onData,
}: Subscription): () => void {
  if (!marketId) return () => {};
  ensureSocket();
  if (!subscribers.has(marketId)) {
    subscribers.set(marketId, new Set());
    sendSubscribe(marketId);
  }
  subscribers.get(marketId)!.add(onData);
  return () => {
    const set = subscribers.get(marketId);
    if (!set) return;
    set.delete(onData);
    if (!set.size) {
      subscribers.delete(marketId);
      // No clean unsubscribe API in RTDS stub; benign to leave
    }
  };
}

// Helper to derive smart-money heuristics from trades
export type SmartPulse = {
  inflowUsd: number;
  whaleScore: number;
  trades: number;
  bookImbalance?: number;
  bookDepthUsd?: number;
};

export function computeSmartPulse(
  trades: { amount?: number; price?: number }[],
  orderbook?: OrderbookSnapshot | null
): SmartPulse {
  const volumes = trades
    .map((t) => (t.amount ?? 0) * (t.price ?? 0))
    .filter((v) => Number.isFinite(v));
  const inflow = volumes.reduce((a, b) => a + b, 0);
  const whales = volumes.filter((v) => v > 5000).length;
  const tradeWhale = inflow > 0 ? whales / Math.max(trades.length, 1) : 0;

  let depthUsd = 0;
  let imbalance = 0;
  let bookWhale = 0;
  if (orderbook) {
    const bidsDepth = orderbook.bids
      .map((l) => (l.size ?? 0) * (l.price ?? 0))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => a + b, 0);
    const asksDepth = orderbook.asks
      .map((l) => (l.size ?? 0) * (l.price ?? 0))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => a + b, 0);
    depthUsd = bidsDepth + asksDepth;
    const total = bidsDepth + asksDepth;
    imbalance = total > 0 ? Number(((bidsDepth - asksDepth) / total).toFixed(2)) : 0;
    const largeOrders = [...orderbook.bids, ...orderbook.asks].filter(
      (l) => (l.size ?? 0) * (l.price ?? 0) > 5000
    ).length;
    bookWhale = total > 0 ? largeOrders / (orderbook.bids.length + orderbook.asks.length || 1) : 0;
  }

  const whaleScore = Number(((tradeWhale + bookWhale) / 2).toFixed(2));
  return {
    inflowUsd: Math.round(inflow),
    whaleScore,
    trades: trades.length,
    bookImbalance: imbalance,
    bookDepthUsd: Math.round(depthUsd),
  };
}

export type OrderbookSnapshot = {
  bids: { price?: number; size?: number }[];
  asks: { price?: number; size?: number }[];
};

export async function fetchOrderbookSnapshot(
  marketId: string
): Promise<OrderbookSnapshot | null> {
  if (!marketId) return null;
  const url = `https://clob.polymarket.com/markets/${marketId}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return null;
    }
    const payload = (await res.json()) as {
      orderbook?: { bids?: any[]; asks?: any[] };
      bids?: any[];
      asks?: any[];
    };
    const bids = normalizeLevels(payload?.orderbook?.bids ?? payload?.bids ?? []);
    const asks = normalizeLevels(payload?.orderbook?.asks ?? payload?.asks ?? []);
    return { bids, asks };
  } catch (err) {
    console.warn('[orderbook] fetch failed', err);
    return null;
  }
}

function normalizeLevels(levels: any[]): { price?: number; size?: number }[] {
  const normalized: { price?: number; size?: number }[] = [];
  for (const entry of levels ?? []) {
    if (!entry) continue;
    if (Array.isArray(entry) && entry.length >= 2) {
      normalized.push({ price: Number(entry[0]), size: Number(entry[1]) });
      continue;
    }
    if (typeof entry === 'object') {
      normalized.push({
        price: entry.price ? Number(entry.price) : undefined,
        size: entry.size
          ? Number(entry.size)
          : entry.amount
            ? Number(entry.amount)
            : undefined,
      });
    }
  }
  return normalized;
}
