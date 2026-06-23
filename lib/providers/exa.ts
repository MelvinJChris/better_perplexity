import { ProviderError } from '@/lib/providers/errors';
import type { Source } from '@/lib/types';

// Exa provides the semantic (neural) search signal that catches relevant
// sources keyword search misses. Mapped into the shared Source shape.

const EXA_URL = 'https://api.exa.ai/search';

interface ExaResult {
  title?: string | null;
  url?: string;
  text?: string;
  score?: number;
}

interface ExaResponse {
  results?: ExaResult[];
}

export interface ExaConfig {
  apiKey: string;
  fetchFn?: typeof fetch;
  numResults?: number;
}

export async function searchExa(query: string, config: ExaConfig): Promise<Source[]> {
  const fetchFn = config.fetchFn ?? fetch;
  const res = await fetchFn(EXA_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify({
      query,
      numResults: config.numResults ?? 8,
      contents: { text: true },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ProviderError(`Exa ${res.status}: ${detail.slice(0, 200)}`, res.status);
  }

  const json = (await res.json()) as ExaResponse;
  return (json.results ?? [])
    .filter((r): r is ExaResult & { url: string } => typeof r.url === 'string')
    .map((r) => ({
      url: r.url,
      title: r.title ?? r.url,
      snippet: (r.text ?? '').slice(0, 300),
      text: r.text ?? undefined,
      rawRelevance: r.score ?? 0,
    }));
}
