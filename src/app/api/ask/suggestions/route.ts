export const runtime = 'nodejs';

import { NextRequest } from 'next/server';

import { getSuggestedQuestions } from '@/domain/ask/suggestions';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

const handler = async (request: NextRequest) => {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      page?: string;
      marketTitle?: string;
      marketCategory?: string;
      topics?: string[];
      recentQuestion?: string;
      recentAnswer?: string;
    };

    const questions = await getSuggestedQuestions({
      page: body.page ?? 'global',
      marketTitle: body.marketTitle,
      marketCategory: body.marketCategory,
      topics: body.topics,
      recentQuestion: body.recentQuestion,
      recentAnswer: body.recentAnswer,
    });

    return success({ questions });
  } catch (error) {
    console.error('[api] ask suggestions error', error);
    return failure('SUGGESTIONS_FAILED', 'Unable to generate suggestions.', { status: 502 });
  }
};

export const POST = withApiLogging(handler, { action: 'ask.suggestions' });

