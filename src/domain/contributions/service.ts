import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type {
  ContributionStatus,
  UserContribution,
} from '@/domain/types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export interface CreateContributionInput {
  walletAddress: string;
  marketId: string;
  content: string;
  attachmentUrl?: string | null;
  parentId?: string | null;
}

export interface ListContributionsOptions {
  statuses?: ContributionStatus[];
  limit?: number;
  cursor?: string;
  viewerWallet?: string;
  parentId?: string | null;
}

export interface ContributionListResult {
  items: UserContribution[];
  nextCursor?: string;
}

export interface WalletListOptions {
  viewerWallet?: string;
}

export class ContributionValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function createContribution(
  input: CreateContributionInput
): Promise<UserContribution> {
  if (input.attachmentUrl) {
    if (!isValidAttachmentUrl(input.attachmentUrl)) {
      throw new ContributionValidationError(
        'INVALID_ATTACHMENT',
        'Attachment must be https URL ending with an allowed media extension.'
      );
    }
  }
  const record = await prisma.userContribution.create({
    data: {
      walletAddress: normalizeWallet(input.walletAddress),
      marketId: input.marketId,
      content: input.content,
      attachmentUrl: input.attachmentUrl ?? null,
      parentId: input.parentId ? Number(input.parentId) : null,
      status: 'pending',
    },
  });

  return mapContribution(record);
}

export async function listContributionsByMarket(
  marketId: string,
  options: ListContributionsOptions = {}
): Promise<ContributionListResult> {
  const normalizedWallet = options.viewerWallet
    ? normalizeWallet(options.viewerWallet)
    : undefined;
  const limit = clampLimit(options.limit);
  const statuses = options.statuses ?? ['approved'];
  const statusWhere = buildStatusWhere(statuses);
  const baseWhere: Prisma.UserContributionWhereInput = {
    ...(marketId ? { marketId } : {}),
    parentId: options.parentId ? Number(options.parentId) : null,
  };

  const hasStatusFilter = statusWhere && Object.keys(statusWhere).length > 0;

  const where: Prisma.UserContributionWhereInput = normalizedWallet
    ? hasStatusFilter
      ? {
          ...baseWhere,
          OR: [statusWhere, { walletAddress: normalizedWallet }],
        }
      : { ...baseWhere }
    : {
        ...baseWhere,
        ...statusWhere,
      };

  if (options.cursor) {
    const cursorId = Number(options.cursor);
    if (Number.isFinite(cursorId)) {
      where.id = { lt: cursorId };
    }
  }

  const records = await prisma.userContribution.findMany({
    where,
    orderBy: { id: 'desc' },
    take: limit + 1,
    include: normalizedWallet
      ? {
          upvoteRecords: {
            where: { walletAddress: normalizedWallet },
          },
          replies: true,
        }
      : {
          replies: true,
        },
  });

  let nextCursor: string | undefined;
  if (records.length > limit) {
    const cursorRecord = records.pop()!;
    nextCursor = String(cursorRecord.id);
  }

  return {
    items: records.map((record) => mapContribution(record, normalizedWallet)),
    nextCursor,
  };
}

export async function listContributionReplies(
  parentId: string,
  options: ListContributionsOptions = {}
): Promise<ContributionListResult> {
  return listContributionsByMarket('', {
    ...options,
    parentId,
    statuses: options.statuses ?? ['approved'],
  });
}

export async function listContributionsByWallet(
  walletAddress: string,
  options: WalletListOptions = {}
): Promise<UserContribution[]> {
  const normalizedWallet = normalizeWallet(walletAddress);
  const viewerWallet = options.viewerWallet
    ? normalizeWallet(options.viewerWallet)
    : undefined;
  const records = await prisma.userContribution.findMany({
    where: { walletAddress: normalizedWallet },
    orderBy: { id: 'desc' },
    include: viewerWallet
      ? {
          upvoteRecords: {
            where: { walletAddress: viewerWallet },
          },
        }
      : undefined,
  });

  return records.map((record) => mapContribution(record, viewerWallet));
}

export async function moderateContribution(
  contributionId: string,
  status: ContributionStatus,
  meta?: { actor?: string; reason?: string }
): Promise<UserContribution | null> {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.userContribution.findUnique({
        where: { id: Number(contributionId) },
      });
      if (!current) return null;
      const next = await tx.userContribution.update({
        where: { id: Number(contributionId) },
        data: { status, updatedAt: new Date() },
      });
      await tx.contributionAuditLog.create({
        data: {
          contributionId: Number(contributionId),
          previousStatus: current.status,
          newStatus: status,
          actor: meta?.actor ?? 'admin',
          reason: meta?.reason ?? null,
        },
      });
      return next;
    });
    if (!updated) return null;
    return mapContribution(updated);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function upvoteContribution(
  contributionId: string,
  walletAddress: string
): Promise<UserContribution | null> {
  const numericId = Number(contributionId);
  const normalizedWallet = normalizeWallet(walletAddress);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.contributionUpvote.upsert({
        where: {
          contributionId_walletAddress: {
            contributionId: numericId,
            walletAddress: normalizedWallet,
          },
        },
        create: {
          contributionId: numericId,
          walletAddress: normalizedWallet,
        },
        update: {},
      });

      return refreshContributionAggregates(tx, numericId, normalizedWallet);
    });

    return mapContribution(updated, normalizedWallet);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function removeContributionUpvote(
  contributionId: string,
  walletAddress: string
): Promise<UserContribution | null> {
  const numericId = Number(contributionId);
  const normalizedWallet = normalizeWallet(walletAddress);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      try {
        await tx.contributionUpvote.delete({
          where: {
            contributionId_walletAddress: {
              contributionId: numericId,
              walletAddress: normalizedWallet,
            },
          },
        });
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }

      return refreshContributionAggregates(tx, numericId, normalizedWallet);
    });

    return mapContribution(updated, normalizedWallet);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

function mapContribution(
  record: {
    id: number;
    walletAddress: string;
    marketId: string;
    content: string;
    attachmentUrl: string | null;
    parentId: number | null;
    upvotes: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    upvoteRecords?: { walletAddress: string }[];
    replies?: { id: number }[];
  },
  viewerWallet?: string
): UserContribution {
  return {
    id: String(record.id),
    walletAddress: record.walletAddress,
    marketId: record.marketId,
    content: record.content,
    attachmentUrl: record.attachmentUrl,
    parentId: record.parentId ? String(record.parentId) : null,
    upvotes: record.upvotes,
    status: record.status as ContributionStatus,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    ...(viewerWallet
      ? { viewerHasUpvoted: record.upvoteRecords?.length ? true : false }
      : {}),
    ...(record.replies ? { replyCount: record.replies.length } : {}),
  };
}

function clampLimit(limit?: number) {
  if (!limit) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
}

function buildStatusWhere(statuses: ContributionStatus[]) {
  if (!statuses || statuses.length === 0) {
    return {};
  }

  if (statuses.length === 1) {
    return { status: statuses[0] };
  }

  return { status: { in: statuses } };
}

async function refreshContributionAggregates(
  tx: Prisma.TransactionClient,
  contributionId: number,
  viewerWallet?: string
) {
  const total = await tx.contributionUpvote.count({
    where: { contributionId },
  });

  return tx.userContribution.update({
    where: { id: contributionId },
    data: { upvotes: total, updatedAt: new Date() },
    include: viewerWallet
      ? {
          upvoteRecords: {
            where: { walletAddress: viewerWallet },
          },
        }
      : undefined,
  });
}

function normalizeWallet(address: string) {
  return address.trim().toLowerCase();
}

function isValidAttachmentUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.mp4'];
    return allowed.some((ext) => parsed.pathname.toLowerCase().endsWith(ext));
  } catch {
    return false;
  }
}

function isNotFoundError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return true;
  }
  if (typeof error === 'object' && error && 'code' in error) {
    return (error as { code?: string }).code === 'P2025';
  }
  return false;
}
