const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const EMAIL_WEBHOOK_URL = process.env.EMAIL_WEBHOOK_URL;
const EMAIL_WEBHOOK_TOKEN = process.env.EMAIL_WEBHOOK_TOKEN;
const FC_WEBHOOK_URL =
  process.env.FC_WEBHOOK_URL ?? process.env.FARCASTER_WEBHOOK_URL;
const FC_WEBHOOK_TOKEN = process.env.FC_WEBHOOK_TOKEN;

export async function sendNotification(message: string): Promise<void> {
  let delivered = false;
  const tasks: Promise<void>[] = [];

  if (EMAIL_WEBHOOK_URL) {
    tasks.push(
      postJson(
        EMAIL_WEBHOOK_URL,
        { message },
        EMAIL_WEBHOOK_TOKEN
          ? {
              Authorization: `Bearer ${EMAIL_WEBHOOK_TOKEN}`,
            }
          : undefined
      ).then(() => {
        delivered = true;
      }).catch((err) => console.warn("[notify] email webhook error", err))
    );
  }

  if (FC_WEBHOOK_URL) {
    tasks.push(
      postJson(
        FC_WEBHOOK_URL,
        { message },
        FC_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${FC_WEBHOOK_TOKEN}` }
          : undefined
      ).then(() => {
        delivered = true;
      }).catch((err) => console.warn("[notify] fc webhook error", err))
    );
  }

  if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
    tasks.push(
      postJson(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          disable_web_page_preview: true,
        }
      )
        .then(() => {
          delivered = true;
        })
        .catch((err) => console.warn("[notify] telegram error", err))
    );
  }

  await Promise.allSettled(tasks);

  if (!delivered) {
    // Fallback: log to stdout
    console.info("[notify]", message);
  }
}

export function notificationChannels(): ("telegram" | "email" | "farcaster" | "log")[] {
  const channels: ("telegram" | "email" | "farcaster" | "log")[] = [];
  if (EMAIL_WEBHOOK_URL) channels.push("email");
  if (FC_WEBHOOK_URL) channels.push("farcaster");
  if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) channels.push("telegram");
  channels.push("log");
  return channels;
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  headers?: Record<string, string> | false
) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}
