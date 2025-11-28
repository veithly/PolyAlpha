import { logGuardrailDecision } from '@/domain/guardrails/service';

const DEFAULT_MODEL = process.env.FLOCK_GUARDRAIL_MODEL ?? 'qwen2-7b-chat';
const BLOCKLIST = ['exploit', 'hack', 'ddos', 'personal data', 'pii'];

/**
 * Lightweight safety gate for Ask AI questions.
 * Returns false when the prompt is unsafe or when the guardrail model explicitly rejects it.
 */
export async function isQuestionAllowed(question: string): Promise<boolean> {
  if (isKeywordBlocked(question)) {
    await logGuardrailDecision({
      question,
      result: 'block',
      reason: 'keyword',
    });
    return false;
  }

  const apiKey = process.env.FLOCK_API_KEY;
  const endpoint =
    process.env.FLOCK_API_URL ?? 'https://api.flock.io/v1/chat/completions';

  if (!apiKey) {
    // fallback to keyword-only guardrail
    return true;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(apiKey, endpoint),
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are a safety classifier. Reply with only "allow" or "block". Block prompts about attacks, PII harvesting, financial manipulation, self-harm, or hate.',
          },
          { role: 'user', content: question },
        ],
      }),
    });

    if (!response.ok) {
      await logGuardrailDecision({
        question,
        result: 'allow',
        reason: 'fallback_http',
        model: DEFAULT_MODEL,
      });
      return true; // fail open except keyword block
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content: string =
      payload?.choices?.[0]?.message?.content?.toLowerCase?.() ?? '';
    if (!content) {
      await logGuardrailDecision({
        question,
        result: 'allow',
        reason: 'empty',
        model: DEFAULT_MODEL,
      });
      return true;
    }
    const blocked = content.includes('block');
    await logGuardrailDecision({
      question,
      result: blocked ? 'block' : 'allow',
      reason: 'model',
      model: DEFAULT_MODEL,
    });
    return !blocked;
  } catch (error) {
    console.warn('[guardrails] Fallback to keyword-only', error);
    await logGuardrailDecision({
      question,
      result: 'allow',
      reason: 'fallback_http',
      model: DEFAULT_MODEL,
    });
    return true;
  }
}

/**
 * Post-answer moderation; returns true if safe to return to user.
 */
export async function isAnswerSafe(answer: string): Promise<boolean> {
  if (!answer || answer.trim().length === 0) return true;
  if (containsHighRiskContent(answer)) {
    await logGuardrailDecision({
      question: answer.slice(0, 240),
      result: 'block',
      reason: 'output',
    });
    return false;
  }
  // reuse model moderation if available
  const apiKey = process.env.FLOCK_API_KEY;
  const endpoint =
    process.env.FLOCK_API_URL ?? 'https://api.flock.io/v1/chat/completions';
  if (!apiKey) return true;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(apiKey, endpoint),
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are a safety classifier. Reply with only "allow" or "block". Block financial advice, self-harm encouragement, hate, or personal data.',
          },
          { role: 'user', content: answer },
        ],
      }),
    });
    if (!response.ok) return true;
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content: string =
      payload?.choices?.[0]?.message?.content?.toLowerCase?.() ?? '';
    if (!content) return true;
    const blocked = content.includes('block');
    await logGuardrailDecision({
      question: answer.slice(0, 240),
      result: blocked ? 'block' : 'allow',
      reason: 'output',
      model: DEFAULT_MODEL,
    });
    return !blocked;
  } catch {
    return true;
  }
}

function isKeywordBlocked(question: string) {
  const lower = question.toLowerCase();
  return BLOCKLIST.some((term) => lower.includes(term));
}

function containsHighRiskContent(answer: string) {
  const lower = answer.toLowerCase();
  return (
    lower.includes('ssn') ||
    lower.includes('credit card') ||
    lower.includes('suicide') ||
    lower.includes('kill') ||
    lower.includes('murder')
  );
}

function buildHeaders(apiKey: string, endpoint: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const normalizedUrl = endpoint.toLowerCase();
  if (normalizedUrl.includes('/chat/completions')) {
    headers['x-litellm-api-key'] = apiKey;
  } else {
    headers['x-api-key'] = apiKey;
  }
  return headers;
}

export function redactAnswer(answer: string): {
  text: string;
  redacted: boolean;
  redactions: string[];
} {
  let text = answer;
  let redacted = false;
  const redactions: string[] = [];
  const rules: { name: string; regex: RegExp; replacement: string }[] = [
    {
      name: 'email',
      regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      replacement: '[redacted-email]',
    },
    {
      name: 'wallet',
      regex: /0x[a-fA-F0-9]{40}/g,
      replacement: '[redacted-wallet]',
    },
    {
      name: 'phone',
      regex: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      replacement: '[redacted-phone]',
    },
  ];

  for (const rule of rules) {
    if (rule.regex.test(text)) {
      text = text.replace(rule.regex, rule.replacement);
      redacted = true;
      redactions.push(rule.name);
    }
  }

  return { text, redacted, redactions };
}
