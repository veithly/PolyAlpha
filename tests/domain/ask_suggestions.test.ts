import { describe, expect, it, vi, afterEach } from 'vitest';

import { getSuggestedQuestions } from '@/domain/ask/suggestions';
import * as ai from '@/lib/ai';

afterEach(() => {
  vi.resetAllMocks();
});

describe('getSuggestedQuestions', () => {
  it('returns three dashboard fallbacks', async () => {
    const result = await getSuggestedQuestions({ page: 'dashboard' });
    expect(result).toHaveLength(3);
  });

  it('includes market title in market fallbacks', async () => {
    const title = 'Tesla odds';
    const result = await getSuggestedQuestions({ page: 'market', marketTitle: title });
    expect(result.some((q) => q.toLowerCase().includes('tesla'))).toBe(true);
  });

  it('adds topical hints for macro', async () => {
    const result = await getSuggestedQuestions({ page: 'market', topics: ['macro'] });
    expect(result.some((q) => q.toLowerCase().includes('macro'))).toBe(true);
  });

  it('merges AI output while removing duplicates', async () => {
    vi.spyOn(ai, 'generateSuggestedQuestions').mockResolvedValue([
      'What is liquidity here?',
      'What is liquidity here?',
      'Top catalysts?',
    ]);
    const result = await getSuggestedQuestions({ page: 'dashboard' });
    expect(result[0]).toBe('What is liquidity here?');
    expect(new Set(result).size).toBe(result.length);
  });
});
