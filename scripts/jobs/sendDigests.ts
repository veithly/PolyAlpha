import { sendDailyDigests } from '@/domain/notifications/service';
import { prisma } from '@/lib/prisma';

async function main() {
  const sent = await sendDailyDigests();
  console.log(`Digest notifications processed: ${sent}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Digest job failed', error);
  prisma.$disconnect();
  process.exit(1);
});

