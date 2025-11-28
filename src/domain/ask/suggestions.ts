import { generateSuggestedQuestions, SuggestionContext } from '@/lib/ai';

export type SuggestionRequest = SuggestionContext & {
  page?: string;
};

export async function getSuggestedQuestions(context: SuggestionRequest): Promise<string[]> {
  const fallback = buildFallback(context);
  try {
    const aiList = await generateSuggestedQuestions(context);
    if (aiList && aiList.length) {
      return mergeAndTrim(aiList, fallback);
    }
  } catch (error) {
    console.warn('[ask] suggestion AI failed, using fallback', error);
  }
  return fallback.slice(0, 3);
}

function buildFallback(context: SuggestionRequest): string[] {
  const page = (context.page ?? 'global').toLowerCase();
  const topics = (context.topics ?? []).map((t) => t.toLowerCase());
  const title = context.marketTitle;

  const global = [
    "What are today's top movers and why?",
    'Give me 3 headline catalysts to watch right now.',
    'Which topics are heating up in the last 24h?',
  ];

  const marketScoped = title
    ? [
        `What could move "${title}" in the next 24h?`,
        `Summarize bull vs bear cases for "${title}".`,
        `What signals should I monitor for "${title}"?`,
      ]
    : [
        'What would move this market in the next 24h?',
        'Summarize the bull vs bear cases.',
        'What signals should I monitor here?',
      ];

  const settings = [
    'How should I tune my topics to get better alerts?',
    'Which notifications matter most for my markets?',
    'Suggest markets that fit my preferences today.',
  ];

  const byPage: Record<string, string[]> = {
    dashboard: global,
    home: global,
    market: marketScoped,
    detail: marketScoped,
    settings,
    preferences: settings,
    global,
  };

  let base = byPage[page] ?? global;

  if (topics.includes('macro')) {
    base = [
      'How could macro data this week move odds?',
      'What central bank events should I watch?',
      ...base,
    ];
  }
  if (topics.includes('politics')) {
    base = [
      'What political headlines could swing this market?',
      'Which upcoming elections or votes matter here?',
      'What political headlines could swing this market?',
      ...base,
    ];
  }
  if (topics.includes('sports')) {
    base = [
      'Which injuries or lineup changes impact odds most?',
      'What schedule quirks should I know?',
      ...base,
    ];
  }
  if (topics.includes('meme')) {
    base = ['What viral events could move sentiment?', ...base];
  }
  if (topics.includes('crypto')) {
    base = ['What on-chain signals should I monitor?', ...base];
  }

  return unique(base);
}

function mergeAndTrim(primary: string[], fallback: string[]): string[] {
  return unique([...primary, ...fallback]).slice(0, 3);
}

function unique(list: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list.map((i) => i.trim()).filter(Boolean)) {
    if (seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    result.push(item);
  }
  return result;
}
