import type { D1Database } from '@cloudflare/workers-types';
import { PrismaD1 } from '@prisma/adapter-d1';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { PrismaClient as PrismaClientEdge } from '@prisma/client/edge';
import { PrismaClient as PrismaClientNode } from '@prisma/client';

type AnyPrismaClient = PrismaClientEdge | PrismaClientNode;

type PrismaGlobal = {
  prismaNode?: PrismaClientNode;
  prismaEdge?: PrismaClientEdge;
};

const globalForPrisma = globalThis as unknown as PrismaGlobal;

const isCloudflareRuntime =
  process.env.CF_PAGES === '1' ||
  process.env.NEXT_RUNTIME === 'edge' ||
  process.env.CLOUDFLARE_D1 === 'true';

function getD1Binding(): D1Database {
  try {
    const ctx = getRequestContext() as any;
    if (ctx?.env?.DB) {
      return ctx.env.DB as D1Database;
    }
  } catch {
    // noop – handled below
  }

  const fallback = (globalThis as any).DB as D1Database | undefined;
  if (fallback) return fallback;

  throw new Error(
    'Cloudflare D1 binding `DB` not found. Ensure wrangler.toml declares [[d1_databases]] binding = "DB".',
  );
}

function getEdgeClient(): PrismaClientEdge {
  if (globalForPrisma.prismaEdge) return globalForPrisma.prismaEdge;

  const adapter = new PrismaD1(getD1Binding());
  const client = new PrismaClientEdge({ adapter: adapter as any });
  globalForPrisma.prismaEdge = client;
  return client;
}

function getNodeClient(): PrismaClientNode {
  if (globalForPrisma.prismaNode) return globalForPrisma.prismaNode;

  const client = new PrismaClientNode({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prismaNode = client;
  }
  return client;
}

function getClient(): AnyPrismaClient {
  return isCloudflareRuntime ? getEdgeClient() : getNodeClient();
}

export const prisma = new Proxy({} as AnyPrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient() as any;
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export async function disconnectPrisma() {
  const client = (isCloudflareRuntime
    ? globalForPrisma.prismaEdge
    : globalForPrisma.prismaNode) as AnyPrismaClient | undefined;
  if (client) {
    await client.$disconnect();
  }
}
