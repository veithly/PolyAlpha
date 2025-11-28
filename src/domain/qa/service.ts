import { prisma } from '../../lib/prisma';
import type { QaLog } from '../types';

export interface LogQaInput {
  walletAddress?: string;
  marketId?: string;
  question: string;
  answer: string;
}

export interface ListQaFilter {
  walletAddress?: string;
  marketId?: string;
  limit?: number;
}

export interface ClearQaFilter {
  walletAddress: string;
  marketId?: string;
}

export async function logQaInteraction(
  input: LogQaInput
): Promise<QaLog> {
  const record = await prisma.qaLog.create({
    data: {
      walletAddress: input.walletAddress
        ? normalizeWallet(input.walletAddress)
        : null,
      marketId: input.marketId ?? null,
      question: input.question,
      answer: input.answer,
    },
  });

  return map(record);
}

export async function listQaLogs(
  filter: ListQaFilter = {}
): Promise<QaLog[]> {
  const records = await prisma.qaLog.findMany({
    where: {
      walletAddress: filter.walletAddress
        ? normalizeWallet(filter.walletAddress)
        : undefined,
      marketId: filter.marketId,
    },
    orderBy: { createdAt: 'desc' },
    take: filter.limit,
  });

  return records.map(map);
}

export async function clearQaLogs(filter: ClearQaFilter): Promise<number> {
  const normalized = normalizeWallet(filter.walletAddress);
  const result = await prisma.qaLog.deleteMany({
    where: {
      walletAddress: normalized,
      marketId: filter.marketId ?? undefined,
    },
  });
  return result.count;
}

function map(record: {
  id: number;
  walletAddress: string | null;
  marketId: string | null;
  question: string;
  answer: string;
  createdAt: Date;
}): QaLog {
  return {
    id: String(record.id),
    walletAddress: record.walletAddress ?? undefined,
    marketId: record.marketId ?? undefined,
    question: record.question,
    answer: record.answer,
    createdAt: record.createdAt.toISOString(),
  };
}

function normalizeWallet(address: string) {
  return address.trim().toLowerCase();
}
