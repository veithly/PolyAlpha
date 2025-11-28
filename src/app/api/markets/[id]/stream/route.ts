export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { fetchMarketDetail } from '@/domain/markets/service';
import { failure } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const INTERVAL_MS = 15000;
const MAX_PUSHES = 10;

const handler = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: marketId } = await params;
  if (!marketId) {
    return failure('INVALID_REQUEST', 'id is required', { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let pushes = 0;
      const encoder = new TextEncoder();

      const pushOnce = async () => {
        try {
          const detail = await fetchMarketDetail(marketId);
          if (detail) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(detail)}\n\n`)
            );
            pushes += 1;
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'fetch_failed' })}\n\n`
            )
          );
        }
      };

      await pushOnce();
      const interval = setInterval(() => {
        pushOnce();
        if (pushes >= MAX_PUSHES) {
          clearInterval(interval);
          controller.close();
        }
      }, INTERVAL_MS);

      const timer = setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, INTERVAL_MS * MAX_PUSHES + 1000);

      controller.enqueue(encoder.encode('event: open\n\n'));

      const onClose = () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
      // ReadableStream controller lacks a closed promise; rely on cancel/close events via return
      (controller as any).closed?.then?.(onClose);
    },
    cancel() {
      // handled by close in interval
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};

export const GET = withApiLogging(handler, { action: 'markets.stream' });
