import { NextRequest } from 'next/server';

type RouteHandler<TContext = unknown> = (
  request: NextRequest,
  context: TContext
) => Promise<Response>;

type LogPayload = {
  action?: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  wallet?: string | null;
  timestamp: string;
};

export function withApiLogging<TContext = unknown>(
  handler: RouteHandler<TContext>,
  metadata?: { action?: string }
): RouteHandler<TContext> {
  return async (request, context) => {
    const startedAt = Date.now();
    let status = 500;
    const resolvedRequest = normalizeRequest(request);
    try {
      const response = await handler(
        resolvedRequest,
        (context ?? ({} as TContext)) as TContext
      );
      status = response.status;
      return response;
    } catch (error) {
      status = resolveStatus(error);
      throw error;
    } finally {
      const url = safeUrl(resolvedRequest.url);
      logApiEvent({
        action: metadata?.action,
        method: resolvedRequest.method ?? 'UNKNOWN',
        path:
          resolvedRequest instanceof NextRequest &&
          typeof resolvedRequest.nextUrl?.pathname === 'string'
            ? resolvedRequest.nextUrl.pathname
            : url?.pathname ?? metadata?.action ?? 'unknown',
        status,
        durationMs: Date.now() - startedAt,
        wallet: resolvedRequest.headers.get('x-wallet-address'),
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function logApiEvent(event: LogPayload) {
  console.info(JSON.stringify({ source: 'api', ...event }));
}

function resolveStatus(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }
  return 500;
}

function normalizeRequest(request?: Request) {
  if (request instanceof NextRequest) {
    return request;
  }
  if (request) {
    try {
      return new NextRequest(request);
    } catch {
      // fall through to placeholder
    }
  }
  return new NextRequest('http://local.test/internal-log');
}

function safeUrl(value?: string) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
