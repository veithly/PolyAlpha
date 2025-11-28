import { useEffect, useRef } from 'react';

import type { SmartPulse } from './polymarket-ws';

export type MarketStreamTick = {
  marketId: string;
  price?: number;
  smart?: SmartPulse;
};

/**
 * Subscribe to /api/markets/stream for the given marketIds.
 * Uses per-market EventSource with simple exponential backoff.
 */
export function useMarketsStream(
  marketIds: string[],
  onUpdate: (tick: MarketStreamTick) => void
) {
  const handlerRef = useRef(onUpdate);
  handlerRef.current = onUpdate;

  useEffect(() => {
    if (!marketIds.length) return;
    const idsKey = marketIds.join(',');
    const active = new Map<
      string,
      { es: EventSource; attempt: number; closed: boolean }
    >();
    let cancelled = false;

    const connect = (marketId: string, attempt = 0) => {
      if (cancelled) return;
      if (active.has(marketId)) {
        active.get(marketId)!.es.close();
        active.delete(marketId);
      }
      const es = new EventSource(`/api/markets/stream?marketId=${marketId}`);
      active.set(marketId, { es, attempt, closed: false });

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.marketId === marketId && data?.type === 'tick') {
            handlerRef.current({
              marketId,
              price: data.price,
              smart: data.smart,
            });
          }
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        es.close();
        const nextAttempt = attempt + 1;
        const delay = Math.min(30000, 2000 * nextAttempt);
        setTimeout(() => connect(marketId, nextAttempt), delay);
      };
    };

    marketIds.forEach((id) => connect(id));

    return () => {
      cancelled = true;
      for (const { es } of active.values()) {
        es.close();
      }
      active.clear();
    };
  }, [marketIds]);
}
