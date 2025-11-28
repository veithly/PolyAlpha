import { prisma } from '@/lib/prisma';

export type GuardrailResult = 'allow' | 'block';
export type GuardrailReason =
  | 'keyword'
  | 'model'
  | 'fallback_http'
  | 'empty'
  | 'output';

export async function logGuardrailDecision(input: {
  question: string;
  result: GuardrailResult;
  reason: GuardrailReason;
  model?: string;
}) {
  try {
    await prisma.guardrailLog.create({
      data: {
        question: input.question.slice(0, 1200),
        result: input.result,
        reason: input.reason,
        model: input.model ?? null,
      },
    });
  } catch (error) {
    console.warn('[guardrail] failed to persist log', error);
  }
}

export async function getRecentGuardrailLogs(limit = 50) {
  const rows = await prisma.guardrailLog.findMany({
    orderBy: { id: 'desc' },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    result: row.result as GuardrailResult,
    reason: row.reason as GuardrailReason,
    model: row.model ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}
