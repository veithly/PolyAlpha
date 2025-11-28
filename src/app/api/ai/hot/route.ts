export const runtime = 'nodejs';
import { NextRequest } from 'next/server';

import { fetchNews } from '@/lib/news';
import { failure, success } from '@/lib/http';
import { withApiLogging } from '@/lib/logging';

export const dynamic = 'force-dynamic';

const FALLBACK_ITEMS = [
  {
    title: 'Polymarket volumes spike on election markets',
    link: 'https://polymarket.com',
  },
  {
    title: 'Crypto meme markets lead gains amid BTC rally',
    link: 'https://polymarket.com',
  },
];

async function handler(request: NextRequest) {
  const topics = request.nextUrl.searchParams.get('topics');
  const query = topics ? `${topics} Polymarket` : 'Polymarket markets';
  try {
    const news = await fetchNews(query, 5);
    const items = (news.length ? news : FALLBACK_ITEMS).slice(0, 5).map((n) => ({
      title: n.title,
      link: n.link,
      updatedAt: new Date().toISOString(),
    }));
    return success({ items });
  } catch (error) {
    console.error('[api] hot feed error', error);
    return failure('HOT_FEED_FAILED', 'Unable to load hot feed.', { status: 502 });
  }
}

export const GET = withApiLogging(handler, { action: 'ai.hot' });
