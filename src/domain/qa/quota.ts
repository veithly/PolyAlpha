import { prisma } from '@/lib/prisma';

const DAILY_LIMIT = Number(process.env.ASK_AI_DAILY_LIMIT ?? 10);

export function getDailyLimit() {
  return DAILY_LIMIT;
}

export async function getEffectiveDailyLimit(
  walletAddress: string
): Promise<number> {
  const normalized = walletAddress.trim().toLowerCase();
  try {
    const pref = await prisma.userPreference.findUnique({
      where: { walletAddress: normalized },
      select: { askLimit: true },
    });
    if (pref?.askLimit && pref.askLimit > 0) {
      return pref.askLimit;
    }
  } catch (error) {
    console.warn('[ask] unable to load personalized limit', error);
  }
  return DAILY_LIMIT;
}

export async function getUsageCount(walletAddress: string, dateKey: string) {
  const record = await prisma.askAiQuota.findUnique({
    where: { walletAddress_dateKey: { walletAddress, dateKey } },
  });
  return record?.count ?? 0;
}

export async function incrementUsage(
  walletAddress: string,
  dateKey: string
) {
  const existing = await prisma.askAiQuota.findUnique({
    where: { walletAddress_dateKey: { walletAddress, dateKey } },
  });

  if (existing) {
    const updated = await prisma.askAiQuota.update({
      where: { walletAddress_dateKey: { walletAddress, dateKey } },
      data: { count: existing.count + 1 },
    });
    return updated.count;
  }

  const created = await prisma.askAiQuota.create({
    data: { walletAddress, dateKey, count: 1 },
  });
  return created.count;
}
