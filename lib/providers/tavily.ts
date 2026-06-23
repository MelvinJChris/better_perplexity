import { ProviderError } from '@/lib/providers/errors';
import type { Source } from '@/lib/types';

// Tavily is the primary (keyword + freshness) search signal. Mapped into the
// shared Source shape so the pipeline never sees a provider-specific field.

const TAVILY_URL = 'https://api.tavily.com/search';

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string | null;
  score?: number;
  published_date?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

export interface TavilyConfig {
  apiKey: string;
  fetchFn?: typeof fetch;
  maxResults?: number;
}

export async function searchTavily(query: string, config: TavilyConfig): Promise<Source[]> {
  const fetchFn = config.fetchFn ?? fetch;
  const res = await fetchFn(TAVILY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: 'advanced',
      max_results: config.maxResults ?? 8,
      include_raw_content: true,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ProviderError(`Tavily ${res.status}: ${detail.slice(0, 200)}`, res.status);
  }

  const json = (await res.json()) as TavilyResponse;
  return (json.results ?? [])
    .filter((r): r is TavilyResult & { url: string } => typeof r.url === 'string')
    .map((r) => ({
      url: r.url,
      title: r.title ?? r.url,
      snippet: r.content ?? '',
      text: r.raw_content ?? undefined,
      rawRelevance: r.score ?? 0,
      publishedAt: r.published_date ?? undefined,
    }));
}
