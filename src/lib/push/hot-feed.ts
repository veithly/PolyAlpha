import { fetchNews } from '@/lib/news';

type HotItem = { title: string; link?: string; updatedAt: string };

let hotCache: { items: HotItem[]; expires: number } | null = null;
const HOT_TTL_MS = 15 * 60 * 1000;

export async function getHotFeed(params: { topics?: string[]; force?: boolean }) {
  if (!params.force && hotCache && hotCache.expires > Date.now()) {
    return hotCache;
  }
  const query = params.topics?.length
    ? `${params.topics.join(' ')} polymarket`
    : 'polymarket markets';
  const news = await fetchNews(query, 5);
  const now = Date.now();
  const items =
    news.length > 0
      ? news.map((n) => ({ ...n, updatedAt: new Date(now).toISOString() }))
      : [
          {
            title: 'Polymarket volumes spike on macro headlines',
            link: 'https://polymarket.com',
            updatedAt: new Date(now).toISOString(),
          },
        ];
  hotCache = { items, expires: now + HOT_TTL_MS };
  return hotCache;
}
