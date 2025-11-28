export const runtime = 'nodejs';
import { NextRequest } from "next/server";

import { failure } from "@/lib/http";
import { withApiLogging } from "@/lib/logging";
import { subscribeMarketTrades, computeSmartPulse, fetchOrderbookSnapshot } from "@/lib/polymarket-ws";

export const dynamic = "force-dynamic";

async function handler(request: NextRequest) {
  if (process.env.POLYMARKET_WS_ENABLED !== "true") {
    return failure(
      "WS_DISABLED",
      "Realtime market stream is disabled in this environment.",
      { status: 503 },
    );
  }
  if (request.headers.get("accept") !== "text/event-stream") {
    return failure("INVALID_REQUEST", "Accept: text/event-stream required", {
      status: 400,
    });
  }
  const marketId = request.nextUrl.searchParams.get("marketId");
  if (!marketId) {
    return failure("INVALID_REQUEST", "marketId is required", { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const trades: { amount?: number; price?: number }[] = [];
      let orderbook: Awaited<ReturnType<typeof fetchOrderbookSnapshot>> | null =
        null;
      let closed = false;

      const safeEnqueue = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          closed = true;
        }
      };

      const refreshOrderbook = async () => {
        try {
          orderbook = await fetchOrderbookSnapshot(marketId);
        } catch {
          // swallow snapshot errors; stream keeps running
        }
      };
      refreshOrderbook().catch(() => {});
      const orderbookInterval = setInterval(refreshOrderbook, 20000);
      const unsubscribe = subscribeMarketTrades({
        marketId,
        onData: (msg) => {
          const amount = Number(msg?.size ?? msg?.amount);
          const price = Number(msg?.price ?? msg?.last_price);
          if (!Number.isNaN(amount) && !Number.isNaN(price)) {
            trades.push({ amount, price });
            if (trades.length > 100) trades.shift();
          }
          const pulse = computeSmartPulse(trades.slice(-50), orderbook);
          const payload = {
            type: "tick",
            marketId,
            price,
            amount,
            smart: pulse,
            ts: Date.now(),
          };
          safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
        },
      });

      const heartbeat = setInterval(() => {
        safeEnqueue('data: {"type":"ping"}\n\n');
      }, 15000);

      safeEnqueue(
        `data: ${JSON.stringify({
          type: "ready",
          marketId,
          message: "Subscribed to Polymarket trades (RTDS).",
        })}\n\n`
      );

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(orderbookInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      request.signal?.addEventListener("abort", cleanup);
      (controller as any).closed?.finally?.(cleanup);
    },
    cancel() {
      // no-op; cleanup handled via abort/closed hook
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache",
    },
  });
}

export const GET = withApiLogging(handler, { action: "markets.stream" });
