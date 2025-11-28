import { afterEach, describe, expect, it, vi } from 'vitest';

type PreferenceRecord = {
  walletAddress: string;
  topics: string;
  notifyDaily: boolean;
  createdAt: Date;
  updatedAt: Date;
};
type InsightRecord = {
  dateKey: string;
  content: string;
  topics: string | null;
  generatedAt: Date;
};
type SummaryRecord = {
  marketId: string;
  content: string;
  language: string | null;
  modelName: string | null;
  generatedAt: Date;
};
type ContributionRecord = {
  id: number;
  walletAddress: string;
  marketId: string;
  content: string;
  parentId: number | null;
  upvotes: number;
  status: 'pending' | 'approved' | 'hidden' | 'flagged' | 'rejected' | 'needs_review';
  createdAt: Date;
  updatedAt: Date;
};
type ContributionAuditRecord = {
  id: number;
  contributionId: number;
  previousStatus: string;
  newStatus: string;
  actor: string;
  reason?: string | null;
  createdAt: Date;
};
type QaRecord = {
  id: number;
  walletAddress: string | null;
  marketId: string | null;
  question: string;
  answer: string;
  createdAt: Date;
};
type CachedMarketRecord = {
  marketId: string;
  title: string;
  category: string;
  topics: string;
  status: string;
  yesProbability: number;
  yesPrice: number;
  change24h: number;
  volume24h: number;
  totalVolume: number | null;
  liquidity: number | null;
  polymarketUrl: string;
  isHot: boolean;
  isSpike: boolean;
  updatedAt: Date;
};
type AskQuotaRecord = {
  walletAddress: string;
  dateKey: string;
  count: number;
};
type ContributionUpvoteRecord = {
  id: number;
  contributionId: number;
  walletAddress: string;
  createdAt: Date;
};

const store = {
  preferences: new Map<string, PreferenceRecord>(),
  insights: new Map<string, InsightRecord>(),
  summaries: new Map<string, SummaryRecord>(),
  contributions: new Map<number, ContributionRecord>(),
  contributionAudits: new Map<number, ContributionAuditRecord>(),
  contributionUpvotes: new Map<string, ContributionUpvoteRecord>(),
  qaLogs: new Map<number, QaRecord>(),
  cachedMarkets: new Map<string, CachedMarketRecord>(),
  askQuotas: new Map<string, AskQuotaRecord>(),
};

let contributionId = 1;
let contributionAuditId = 1;
let contributionUpvoteId = 1;
let qaId = 1;

function resetStore() {
  store.preferences.clear();
  store.insights.clear();
  store.summaries.clear();
  store.contributions.clear();
  store.contributionAudits.clear();
  store.contributionUpvotes.clear();
  store.qaLogs.clear();
  store.cachedMarkets.clear();
  store.askQuotas.clear();
  contributionId = 1;
  contributionAuditId = 1;
  contributionUpvoteId = 1;
  qaId = 1;
}

vi.mock('../../src/lib/prisma', () => {
  const prismaMock: any = {
    userPreference: {
      findUnique: async ({ where }: { where: { walletAddress: string } }) =>
        store.preferences.get(where.walletAddress) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { walletAddress: string };
        create: { walletAddress: string; topics: string; notifyDaily: boolean };
        update: { topics: string; notifyDaily: boolean };
      }) => {
        const existing = store.preferences.get(where.walletAddress);
        if (existing) {
          const updated = {
            ...existing,
            topics: update.topics,
            notifyDaily: update.notifyDaily,
            updatedAt: new Date(),
          };
          store.preferences.set(where.walletAddress, updated);
          return updated;
        }

        const created: PreferenceRecord = {
          walletAddress: create.walletAddress,
          topics: create.topics,
          notifyDaily: create.notifyDaily,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.preferences.set(where.walletAddress, created);
        return created;
      },
    },
    aiInsight: {
      findUnique: async ({ where }: { where: { dateKey: string } }) =>
        store.insights.get(where.dateKey) ?? null,
      findFirst: async () => {
        const latest = [...store.insights.values()].sort(
          (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()
        )[0];
        return latest ?? null;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { dateKey: string };
        create: InsightRecord;
        update: InsightRecord;
      }) => {
        const next = create ?? update;
        store.insights.set(where.dateKey, {
          dateKey: where.dateKey,
          content: next.content,
          topics: next.topics,
          generatedAt: next.generatedAt,
        });
        return store.insights.get(where.dateKey)!;
      },
    },
    marketSummary: {
      findUnique: async ({ where }: { where: { marketId: string } }) =>
        store.summaries.get(where.marketId) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { marketId: string };
        create: SummaryRecord;
        update: SummaryRecord;
      }) => {
        const record: SummaryRecord = {
          marketId: where.marketId,
          content: create?.content ?? update.content,
          language: create?.language ?? update.language,
          modelName: create?.modelName ?? update.modelName,
          generatedAt: create?.generatedAt ?? update.generatedAt,
        };
        store.summaries.set(where.marketId, record);
        return record;
      },
    },
    userContribution: {
      create: async ({ data }: { data: Partial<ContributionRecord> }) => {
        const record: ContributionRecord = {
          id: contributionId++,
          walletAddress: data.walletAddress ?? '',
          marketId: data.marketId ?? '',
          content: data.content ?? '',
          parentId: data.parentId ?? null,
          upvotes: data.upvotes ?? 0,
          status: (data.status as ContributionRecord['status']) ?? 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.contributions.set(record.id, record);
        return { ...record };
      },
      findMany: async ({
        where = {},
        take,
        include,
      }: {
        where?: {
          marketId?: string;
          walletAddress?: string;
          parentId?: number | null;
          status?:
            | ContributionRecord['status']
            | { in: ContributionRecord['status'][] };
          id?: { lt: number };
          OR?: {
            walletAddress?: string;
            status?:
              | ContributionRecord['status']
              | { in: ContributionRecord['status'][] };
          }[];
        };
        take?: number;
        include?: { upvoteRecords?: { where: { walletAddress: string } } };
      }) => {
        const { OR, ...baseWhere } = where;

        const matches = (
          item: ContributionRecord,
          clause: Partial<ContributionRecord> & {
            status?:
              | ContributionRecord['status']
              | { in: ContributionRecord['status'][] };
            id?: { lt: number };
          }
        ) => {
          if (clause.marketId && item.marketId !== clause.marketId) return false;
          if (clause.walletAddress && item.walletAddress !== clause.walletAddress)
            return false;
          if (clause.parentId !== undefined) {
            if (clause.parentId === null) {
              if (item.parentId !== null) return false;
            } else if (item.parentId !== clause.parentId) {
              return false;
            }
          }
          if (clause.status) {
            if (typeof clause.status === 'string') {
              if (item.status !== clause.status) return false;
            } else if (clause.status.in?.length) {
              if (!clause.status.in.includes(item.status)) return false;
            }
          }
          if (clause.id?.lt && !(item.id < clause.id.lt)) return false;
          return true;
        };

        let rows = [...store.contributions.values()].filter((item) => {
          if (!matches(item, baseWhere)) return false;
          if (OR?.length) {
            return OR.some((clause) => matches(item, clause));
          }
          return true;
        });

        rows = rows.sort((a, b) => b.id - a.id);
        if (typeof take === 'number') {
          rows = rows.slice(0, take);
        }

        return rows.map((record) => {
          if (include?.upvoteRecords) {
            const viewer = include.upvoteRecords.where.walletAddress;
            const key = `${record.id}:${viewer}`;
            const hasVote = store.contributionUpvotes.has(key);
            return {
              ...record,
              upvoteRecords: hasVote ? [{ walletAddress: viewer }] : [],
            };
          }
          return { ...record };
        });
      },
      update: async ({ where, data }: { where: { id: number }; data: any }) => {
        const record = store.contributions.get(where.id);
        if (!record) {
          const error = { code: 'P2025' };
          throw error;
        }
        if (data.upvotes !== undefined) {
          if (typeof data.upvotes === 'number') {
            record.upvotes = data.upvotes;
          } else if (typeof data.upvotes.increment === 'number') {
            record.upvotes += data.upvotes.increment;
          }
        }
        if (data.status) {
          record.status = data.status;
        }
        if (data.updatedAt instanceof Date) {
          record.updatedAt = data.updatedAt;
        }
        return { ...record };
      },
      findUnique: async ({ where }: { where: { id: number } }) =>
        store.contributions.get(where.id) ?? null,
      deleteMany: async () => {
        const count = store.contributions.size;
        store.contributions.clear();
        return { count };
      },
    },
    contributionUpvote: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: {
          contributionId_walletAddress: { contributionId: number; walletAddress: string };
        };
        create: { contributionId: number; walletAddress: string };
        update: Record<string, unknown>;
      }) => {
        const key = `${where.contributionId_walletAddress.contributionId}:${where.contributionId_walletAddress.walletAddress}`;
        const existing = store.contributionUpvotes.get(key);
        if (existing) {
          const next = { ...existing, ...update };
          store.contributionUpvotes.set(key, next);
          return next;
        }
        const record: ContributionUpvoteRecord = {
          id: contributionUpvoteId++,
          contributionId: create.contributionId,
          walletAddress: create.walletAddress,
          createdAt: new Date(),
        };
        store.contributionUpvotes.set(key, record);
        return record;
      },
      delete: async ({
        where,
      }: {
        where: {
          contributionId_walletAddress: { contributionId: number; walletAddress: string };
        };
      }) => {
        const key = `${where.contributionId_walletAddress.contributionId}:${where.contributionId_walletAddress.walletAddress}`;
        const existing = store.contributionUpvotes.get(key);
        if (!existing) {
          throw { code: 'P2025' };
        }
        store.contributionUpvotes.delete(key);
        return existing;
      },
      count: async ({ where }: { where: { contributionId: number } }) => {
        let total = 0;
        for (const record of store.contributionUpvotes.values()) {
          if (record.contributionId === where.contributionId) {
            total += 1;
          }
        }
        return total;
      },
    },
    qaLog: {
      create: async ({ data }: { data: { walletAddress: string | null; marketId: string | null; question: string; answer: string } }) => {
        const record: QaRecord = {
          id: qaId++,
          walletAddress: data.walletAddress,
          marketId: data.marketId,
          question: data.question,
          answer: data.answer,
          createdAt: new Date(),
        };
        store.qaLogs.set(record.id, record);
        return record;
      },
      findMany: async ({ where, take }: { where: { walletAddress?: string; marketId?: string }; take?: number }) => {
        let rows = [...store.qaLogs.values()].filter((row) => {
          if (where.walletAddress && row.walletAddress !== where.walletAddress) return false;
          if (where.marketId && row.marketId !== where.marketId) return false;
          return true;
        });
        rows = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return typeof take === 'number' ? rows.slice(0, take) : rows;
      },
      deleteMany: async () => {
        const count = store.qaLogs.size;
        store.qaLogs.clear();
        return { count };
      },
    },
    cachedMarket: {
      upsert: async ({ where, create }: { where: { marketId: string }; create: CachedMarketRecord }) => {
        const record: CachedMarketRecord = {
          marketId: where.marketId,
          title: create.title,
          category: create.category,
          topics: create.topics,
          status: create.status,
          yesProbability: create.yesProbability,
          yesPrice: create.yesPrice,
          change24h: create.change24h,
          volume24h: create.volume24h,
          totalVolume: create.totalVolume,
          liquidity: create.liquidity,
          polymarketUrl: create.polymarketUrl,
          isHot: create.isHot,
          isSpike: create.isSpike,
          updatedAt: new Date(),
        };
        store.cachedMarkets.set(where.marketId, record);
        return record;
      },
      findMany: async ({ where }: { where?: { topics?: { hasSome: string[] } } }) => {
        const filter = where ?? {};
        return [...store.cachedMarkets.values()].filter((item) => {
          if (filter.topics?.hasSome) {
            const allowed = new Set(filter.topics.hasSome);
            const hasTopic = item.topics.split(',').some((topic) => allowed.has(topic as string));
            if (!hasTopic) return false;
          }
          return true;
        });
      },
    },
    contributionAuditLog: {
      create: async ({ data }: { data: Partial<ContributionAuditRecord> }) => {
        const record: ContributionAuditRecord = {
          id: contributionAuditId++,
          contributionId: data.contributionId ?? 0,
          previousStatus: data.previousStatus ?? 'pending',
          newStatus: data.newStatus ?? 'pending',
          actor: data.actor ?? 'admin',
          reason: data.reason ?? null,
          createdAt: new Date(),
        };
        store.contributionAudits.set(record.id, record);
        return record;
      },
    },
    askAiQuota: {
      findUnique: async ({ where }: { where: { walletAddress_dateKey: { walletAddress: string; dateKey: string } } }) => {
        const key = `${where.walletAddress_dateKey.walletAddress}:${where.walletAddress_dateKey.dateKey}`;
        return store.askQuotas.get(key) ?? null;
      },
      create: async ({ data }: { data: AskQuotaRecord }) => {
        const key = `${data.walletAddress}:${data.dateKey}`;
        store.askQuotas.set(key, { ...data });
        return data;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { walletAddress_dateKey: { walletAddress: string; dateKey: string } };
        create: AskQuotaRecord;
        update: AskQuotaRecord;
      }) => {
        const key = `${where.walletAddress_dateKey.walletAddress}:${where.walletAddress_dateKey.dateKey}`;
        const existing = store.askQuotas.get(key);
        const next = existing
          ? { ...existing, count: update.count }
          : { ...create };
        store.askQuotas.set(key, next);
        return next;
      },
    },
  };

  prismaMock.$transaction = async (arg: any) => {
    if (typeof arg === 'function') {
      return arg(prismaMock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    throw new Error('Unsupported transaction mock');
  };

  return { prisma: prismaMock };
});

const {
  upsertUserPreferences,
  getUserPreferences,
} = await import('../../src/domain/preferences/service');
const {
  saveInsight,
  getLatestInsight,
} = await import('../../src/domain/insights/service');
const {
  upsertMarketSummary,
  getMarketSummaryCache,
} = await import('../../src/domain/marketSummaries/service');
const {
  upsertMarketSnapshots,
  getCachedMarkets,
} = await import('../../src/domain/markets/cache');
const {
  createContribution,
  listContributionsByMarket,
  ContributionValidationError,
} = await import('../../src/domain/contributions/service');
const {
  logQaInteraction,
  listQaLogs,
} = await import('../../src/domain/qa/service');
const {
  getUsageCount,
  incrementUsage,
} = await import('../../src/domain/qa/quota');

afterEach(() => {
  resetStore();
});

describe('SQLite persistence services (Prisma abstraction)', () => {
  it('upserts and fetches user preferences', async () => {
    const saved = await upsertUserPreferences({
      walletAddress: '0xABCDEF',
      topics: ['crypto'],
      notifyDaily: true,
    });
    expect(saved.walletAddress).toBe('0xabcdef');

    const fetched = await getUserPreferences('0xABCDEF');
    expect(fetched).toMatchObject({
      walletAddress: '0xabcdef',
      topics: ['crypto'],
      notifyDaily: true,
    });
  });

  it('stores AI insights and returns the latest record', async () => {
    await saveInsight({
      dateKey: '2025-11-19',
      content: '{"sections":[]}',
      topics: ['politics'],
      generatedAt: '2025-11-19T00:00:00Z',
      cadence: 'daily',
    });

    const insight = await getLatestInsight();
    expect(insight).not.toBeNull();
    expect(insight?.topics).toContain('politics');
  });

  it('caches and retrieves market summaries', async () => {
    await upsertMarketSummary({
      marketId: 'm-1',
      summary: 'Test summary',
      language: 'en',
      model: 'qwen',
      generatedAt: '2025-11-19T00:00:00Z',
    });

    const cached = await getMarketSummaryCache('m-1');
    expect(cached).toMatchObject({
      marketId: 'm-1',
      summary: 'Test summary',
      language: 'en',
      model: 'qwen',
    });
  });

  it('records user contributions and supports listing by market', async () => {
    await createContribution({
      walletAddress: '0x123',
      marketId: 'm-42',
      content: 'My thesis',
    });

    const result = await listContributionsByMarket('m-42', {
      statuses: ['pending'],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe('My thesis');
    expect(result.items[0].status).toBe('pending');
  });

  it('includes viewer pending contribution in market list', async () => {
    await createContribution({
      walletAddress: '0xabc',
      marketId: 'm-100',
      content: 'Viewer post',
    });

    const asViewer = await listContributionsByMarket('m-100', {
      viewerWallet: '0xabc',
    });
    expect(asViewer.items).toHaveLength(1);
    expect(asViewer.items[0].status).toBe('pending');

    const asOther = await listContributionsByMarket('m-100', {
      viewerWallet: '0xdef',
    });
    expect(asOther.items).toHaveLength(0);
  });

  it('rejects invalid attachment urls', async () => {
    await expect(
      createContribution({
        walletAddress: '0x123',
        marketId: 'm-42',
        content: 'bad attachment',
        attachmentUrl: 'http://example.com/file.exe',
      })
    ).rejects.toBeInstanceOf(ContributionValidationError);
  });

  it('logs QA interactions and filters results', async () => {
    await logQaInteraction({
      walletAddress: '0x777',
      marketId: 'm-99',
      question: 'Why is this moving?',
      answer: 'Breaking news',
    });

    const logs = await listQaLogs({ walletAddress: '0x777' });
    expect(logs).toHaveLength(1);
    expect(logs[0].question).toMatch(/Why/);
  });

  it('stores cached markets and retrieves filtered results', async () => {
    await upsertMarketSnapshots([
      {
        id: 'm-1',
        title: 'Crypto question',
        category: 'Crypto',
        topics: ['crypto'],
        status: 'open',
        yesProbability: 0.4,
        yesPrice: 0.4,
        change24h: 0.1,
        volume24h: 1200,
        totalVolume: 5000,
        liquidity: 1000,
        isHot: true,
        isSpike: false,
        polymarketUrl: '#',
        updatedAt: new Date().toISOString(),
      },
    ]);

    const cached = await getCachedMarkets({ topics: ['crypto'] });
    expect(cached).toHaveLength(1);
    expect(cached[0].title).toContain('Crypto');
  });

  it('increments and retrieves Ask AI quotas', async () => {
    const dateKey = '2025-11-19';
    const wallet = '0xabc';
    const before = await getUsageCount(wallet, dateKey);
    expect(before).toBe(0);
    await incrementUsage(wallet, dateKey);
    const after = await getUsageCount(wallet, dateKey);
    expect(after).toBe(1);
  });
});
