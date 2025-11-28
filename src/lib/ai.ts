import type {
  AiInsight,
  AiInsightSection,
  AiInsightSectionItem,
  AiMarketSummary,
  InsightCadence,
  MarketDetail,
  MarketSummary,
} from '../domain/types';
import {
  buildAskPrompt,
  buildInsightSystemPrompt,
  buildInsightUserMessage,
  buildMarketSummaryPrompt,
} from './prompts';

export type SuggestionContext = {
  page?: string;
  marketTitle?: string;
  marketCategory?: string;
  topics?: string[];
  recentQuestion?: string;
  recentAnswer?: string;
};

type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

const DEFAULT_FLOCK_API_URL = 'https://api.flock.io/v1/chat/completions';
const FLOCK_MODEL = process.env.FLOCK_MODEL ?? 'qwen2-72b-instruct';

const OPENAI_API_URL = process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export async function generateInsights(
  cadence: InsightCadence,
  markets: MarketSummary[],
  options?: { focusHeading?: string }
): Promise<AiInsight | null> {
  const insights = await callChat([
    {
      role: 'system',
      content: buildInsightSystemPrompt(cadence, options?.focusHeading),
    },
    {
      role: 'user',
      content: buildInsightUserMessage(markets, options?.focusHeading),
    },
  ]);

  if (!insights) return null;

  const sections = normalizeSections(insights);

  const generatedAt = new Date().toISOString();
  return {
    dateKey: buildDateKey(cadence),
    generatedAt,
    model: FLOCK_MODEL,
    cadence,
    sections,
  };
}

export async function summarizeMarket(
  market: MarketDetail,
  opts?: { news?: { title: string; link: string }[] }
): Promise<AiMarketSummary | null> {
  const summary = await callChat([
    {
      role: 'system',
      content: buildMarketSummaryPrompt(market, opts?.news),
    },
    {
      role: 'user',
      content: JSON.stringify(market),
    },
  ]);

  if (!summary) return null;

  return {
    marketId: market.id,
    summary,
    language: 'en',
    model: FLOCK_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

export async function askAiQuestion({
  market,
  question,
  contextNote,
  history,
  timeoutMs,
}: {
  market: MarketDetail;
  question: string;
  contextNote?: string;
  history?: { question: string; answer: string }[];
  timeoutMs?: number;
}): Promise<string | null> {
  const effectiveTimeoutMs = Math.max(2000, Math.min(60_000, timeoutMs ?? 20_000));
  return promiseWithTimeout(
    callChat([
      {
        role: 'system',
        content: 'Answer Polymarket market questions concisely.',
      },
      {
        role: 'user',
        content: buildAskPrompt(question, market, history, contextNote),
      },
    ]),
    effectiveTimeoutMs
  );
}

export async function askAiQuestionStream({
  market,
  question,
  contextNote,
  history,
}: {
  market: MarketDetail;
  question: string;
  contextNote?: string;
  history?: { question: string; answer: string }[];
}): Promise<ReadableStream<Uint8Array> | null> {
  return callChatStream([
    {
      role: 'system',
      content: 'Answer Polymarket market questions concisely.',
    },
    {
      role: 'user',
      content: buildAskPrompt(question, market, history, contextNote),
    },
  ]);
}

export async function generateSuggestedQuestions(
  context: SuggestionContext
): Promise<string[] | null> {
  const baseContext = [
    context.page ? `page: ${context.page}` : null,
    context.marketTitle ? `title: ${context.marketTitle}` : null,
    context.marketCategory ? `category: ${context.marketCategory}` : null,
    context.topics && context.topics.length ? `topics: ${context.topics.join(', ')}` : null,
    context.recentQuestion ? `recentQuestion: ${context.recentQuestion}` : null,
    context.recentAnswer ? `recentAnswer: ${context.recentAnswer}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt =
    'You are a concise Polymarket assistant. Given the page and market context, produce exactly 3 short, diverse suggested user questions that would help users understand catalysts, probabilities, and risks. Return plain text, one question per line, no numbering, no bullets.';

  const raw = await promiseWithTimeout(
    callChat([
      { role: 'system', content: prompt },
      { role: 'user', content: baseContext || 'global dashboard' },
    ]),
    15_000
  );

  if (!raw) return null;

  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(stripLeadingBullet)
    .filter((line) => line.length > 5)
    .slice(0, 3);

  return lines.length ? lines : null;
}

async function callChat(messages: ChatMessage[]): Promise<string | null> {
  try {
    const provider = selectProvider();
    if (provider === 'flock') {
      const primary = await callFlock(messages);
      if (primary) return primary;
      // Fallback to OpenAI when FLock fails but OpenAI is available.
      if (process.env.OPENAI_API_KEY) {
        return callOpenAI(messages);
      }
      return null;
    }
    if (provider === 'openai') {
      return callOpenAI(messages);
    }
    console.warn('No AI provider configured.');
    return null;
  } catch (error) {
    console.error('[ai] callChat error', error);
    return null;
  }
}

async function callChatStream(
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const provider = selectProvider();
    if (provider === 'flock') {
      const primary = await callFlockStream(messages);
      if (primary) return primary;
      if (process.env.OPENAI_API_KEY) {
        return callOpenAiStream(messages);
      }
      return null;
    }
    if (provider === 'openai') return callOpenAiStream(messages);
    console.warn('No AI provider configured.');
    return null;
  } catch (error) {
    console.error('[ai] callChatStream error', error);
    return null;
  }
}

function emitFromBuffer(
  chunk: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
  const line = chunk.trim();
  if (!line) return;
  const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
  if (payload === '[DONE]') return;
  try {
    const parsed = JSON.parse(payload);
    const delta =
      parsed?.choices?.[0]?.delta?.content ??
      parsed?.choices?.[0]?.message?.content ??
      '';
    if (delta) {
      controller.enqueue(encoder.encode(delta));
    }
  } catch {
    controller.enqueue(encoder.encode(payload));
  }
}

function getFlockApiUrl(): string {
  return process.env.FLOCK_API_URL ?? DEFAULT_FLOCK_API_URL;
}

function buildFlockHeaders(apiKey: string, endpoint: string): Record<string, string> {
  const normalizedUrl = endpoint.toLowerCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const usesCompletionsEndpoint = normalizedUrl.includes('/chat/completions');

  if (usesCompletionsEndpoint) {
    headers['x-litellm-api-key'] = apiKey;
  } else {
    headers['x-api-key'] = apiKey;
  }

  return headers;
}

function buildDateKey(cadence: InsightCadence) {
  const iso = new Date().toISOString();
  if (cadence === 'hourly') {
    return iso.slice(0, 13); // YYYY-MM-DDTHH
  }
  if (cadence === 'event') {
    return iso.slice(0, 16); // YYYY-MM-DDTHH:MM
  }
  return iso.slice(0, 10);
}

function normalizeSections(value: string): AiInsightSection[] {
  try {
    const parsed = JSON.parse(value) as { sections?: AiInsightSection[] };
    return (parsed.sections ?? []).map((section) => ({
      ...section,
      confidence:
        typeof section.confidence === 'number'
          ? clamp(section.confidence, 0, 1)
          : undefined,
      items: (section.items ?? []).map((item) => ({
        ...item,
      })),
    }));
  } catch {
    return [
      {
        heading: 'Global',
        items: [
          {
            title: 'Unable to parse AI result',
            summary: value,
          } satisfies AiInsightSectionItem,
        ],
      },
    ];
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function selectProvider(): 'flock' | 'openai' | null {
  if (process.env.FLOCK_API_KEY) return 'flock';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

export function currentProvider() {
  return selectProvider();
}

async function callOpenAI(messages: ChatMessage[]): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.4,
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    console.warn('OpenAI request failed', response.status);
    return null;
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return payload?.choices?.[0]?.message?.content ?? null;
}

async function callOpenAiStream(
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.4,
      stream: true,
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok || !response.body) {
    console.warn('OpenAI streaming request failed', response.status);
    return null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        if (!raw.trim().startsWith('data:')) continue;
        const payload = raw.replace(/^data:\s*/, '').trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          const delta =
            parsed?.choices?.[0]?.delta?.content ??
            parsed?.choices?.[0]?.message?.content ??
            '';
          if (delta) {
            controller.enqueue(encoder.encode(delta));
          }
        } catch {
          controller.enqueue(encoder.encode(payload));
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

function stripLeadingBullet(value: string): string {
  return value.replace(/^[-*\\d\\.\\)\\s]+/, '').trim();
}

async function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  const result = await Promise.race([promise, timeoutPromise]);
  clearTimeout(timer!);
  return result as T | null;
}

async function callFlock(messages: ChatMessage[]): Promise<string | null> {
  try {
    const apiKey = process.env.FLOCK_API_KEY;
    if (!apiKey) return null;

    const endpoint = getFlockApiUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildFlockHeaders(apiKey, endpoint),
      body: JSON.stringify({
        model: FLOCK_MODEL,
        messages,
        temperature: 0.4,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.warn('Flock request failed', response.status);
      return null;
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return payload?.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error('[ai] callFlock error', error);
    return null;
  }
}

async function callFlockStream(
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const apiKey = process.env.FLOCK_API_KEY;
    if (!apiKey) return null;

    const endpoint = getFlockApiUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildFlockHeaders(apiKey, endpoint),
      body: JSON.stringify({
        model: FLOCK_MODEL,
        messages,
        temperature: 0.4,
        stream: true,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok || !response.body) {
      console.warn('Flock streaming request failed', response.status);
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';

    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) {
          if (buffer.length) {
            emitFromBuffer(buffer, controller, encoder);
            buffer = '';
          }
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const raw of lines) {
          emitFromBuffer(raw, controller, encoder);
        }
      },
      cancel() {
        reader.cancel();
      },
    });
  } catch (error) {
    console.error('[ai] callFlockStream error', error);
    return null;
  }
}
