type NewsItem = { title: string; link: string };

// Lightweight scraping via Jina proxy on DuckDuckGo HTML results; no API key needed.
export async function fetchNews(query: string, limit = 5): Promise<NewsItem[]> {
  if (!query) return [];
  const cacheHit = getCache(query);
  if (cacheHit) return cacheHit.slice(0, limit);

  // Jina proxy returns markdown of the HTML page; links become [title](url)
  const url = `https://r.jina.ai/http://duckduckgo.com/html/?q=${encodeURIComponent(
    query + ' news'
  )}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const markdown = await res.text();
    const anchors = [...markdown.matchAll(/\[(.+?)\]\((https?:[^)]+)\)/g)];
    const parsed: NewsItem[] = [];
    for (const match of anchors) {
      const title = match[1]?.trim();
      let link = match[2]?.trim();
      if (!link) continue;
      // DuckDuckGo outbound wrapper
      if (link.includes('duckduckgo.com/l/?uddg=')) {
        const uddg = new URL(link).searchParams.get('uddg');
        if (uddg) link = decodeURIComponent(uddg);
      }
      const isImage = link.endsWith('.ico') || link.includes('external-content');
      const looksLikeImageTitle = title.startsWith('![');
      if (title && link && !isImage && !looksLikeImageTitle && !link.includes('r.jina.ai')) {
        const decodedLink = decodeHtml(link);
        if (!parsed.some((p) => p.link === decodedLink)) {
          parsed.push({ title, link: decodedLink });
        }
      }
      if (parsed.length >= limit) break;
    }
    if (parsed.length) {
      setCache(query, parsed);
    }
    return parsed;
  } catch (error) {
    console.warn('[news] fetch error', error);
    return cacheHit ?? [];
  }
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, '').trim();
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, '&');
}

type CacheEntry = { expires: number; items: NewsItem[] };
const cache = new Map<string, CacheEntry>();
const NEWS_TTL_MS = 20 * 60 * 1000;

function getCache(query: string): NewsItem[] | null {
  const hit = cache.get(query);
  if (hit && hit.expires > Date.now()) {
    return hit.items;
  }
  return null;
}

function setCache(query: string, items: NewsItem[]) {
  cache.set(query, { expires: Date.now() + NEWS_TTL_MS, items });
}

export type { NewsItem };
