#!/usr/bin/env tsx
import { getHotFeed } from "../../src/lib/push/hot-feed";
import { sendNotification } from "../../src/lib/notifications";

async function main() {
  const hot = await getHotFeed({ topics: [], force: true });
  const text = formatHot(hot.items.slice(0, 3));
  await sendNotification(text);
  console.info("[cron:push] sent hot feed", hot.items.length);
}

function formatHot(items: { title: string; link?: string }[]) {
  if (!items.length) return "Hot feed is empty.";
  return `Hot insights:\n${items
    .map((i, idx) => `${idx + 1}. ${i.title}${i.link ? ` (${i.link})` : ""}`)
    .join("\n")}`;
}

main().catch((err) => {
  console.error("[cron:push] failed", err);
  process.exit(1);
});
