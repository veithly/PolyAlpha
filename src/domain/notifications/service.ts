import { prisma } from '@/lib/prisma';
import { getLatestInsight } from '@/domain/insights/service';

type Channel = 'email' | 'telegram' | 'none';

export async function sendDailyDigests(): Promise<number> {
  const prefs = await prisma.userPreference.findMany({
    where: { notifyDaily: true },
  });
  const insight = await getLatestInsight('daily');
  let sent = 0;
  for (const pref of prefs) {
    const channels = safeParseChannels(pref.channels);
    if (!channels || channels.includes('none')) continue;
    for (const channel of channels) {
      await deliver(channel, pref.walletAddress, insight?.content ?? '');
      sent += 1;
    }
  }
  return sent;
}

async function deliver(
  channel: Channel,
  walletAddress: string,
  body: string
): Promise<void> {
  console.log(
    JSON.stringify({
      event: 'notification.deliver',
      channel,
      walletAddress,
      length: body.length,
      timestamp: new Date().toISOString(),
    })
  );
}

function safeParseChannels(serialized: string | null): Channel[] | null {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((v) =>
      v === 'email' || v === 'telegram' || v === 'none'
    ) as Channel[];
  } catch {
    return null;
  }
}
