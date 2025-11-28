import { describe, expect, it, vi, beforeEach } from 'vitest';

import { isQuestionAllowed } from '@/lib/guardrails';
import { logGuardrailDecision } from '@/domain/guardrails/service';

vi.mock('@/domain/guardrails/service', () => ({
  logGuardrailDecision: vi.fn(),
}));

describe('guardrails', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('blocks obvious keywords', async () => {
    const allowed = await isQuestionAllowed('how to ddos a site');
    expect(allowed).toBe(false);
    expect(logGuardrailDecision).toHaveBeenCalled();
  });

  it('allows benign questions when no api key', async () => {
    const allowed = await isQuestionAllowed('How does the market work?');
    expect(allowed).toBe(true);
  });
});
