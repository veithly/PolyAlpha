export const runtime = 'nodejs';
import { NextRequest } from "next/server";

import { getHotFeed } from "@/lib/push/hot-feed";
import { sendNotification } from "@/lib/notifications";
import { failure, success } from "@/lib/http";
import { withApiLogging } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handler(request: NextRequest) {
  const wallet =
    request.headers.get("x-wallet-address") ??
    request.nextUrl.searchParams.get("walletAddress");
  const force = request.nextUrl.searchParams.get("force") === "true";

  try {
    const hot = await getHotFeed({ topics: [], force });
    const text = formatHot(hot.items.slice(0, 3));
    await sendNotification(text + (wallet ? `\nWallet: ${wallet}` : ""));
    return success({ delivered: true, count: hot.items.length });
  } catch (error) {
    console.error("[api] push error", error);
    return failure("PUSH_FAILED", "Unable to send notification.", {
      status: 500,
    });
  }
}

function formatHot(items: { title: string; link?: string }[]) {
  if (!items.length) return "Hot feed is empty.";
  return `Hot insights:\n${items
    .map((i, idx) => `${idx + 1}. ${i.title}${i.link ? ` (${i.link})` : ""}`)
    .join("\n")}`;
}

export const POST = withApiLogging(handler, { action: "ai.push" });
export const GET = withApiLogging(handler, { action: "ai.push" });
