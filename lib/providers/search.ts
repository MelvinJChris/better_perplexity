import { getEnv } from '@/lib/env';
import { dedupeByEmbedding, dedupeByUrl } from '@/lib/pipeline/dedupe';
import { searchExa } from '@/lib/providers/exa';
import type { LlmProvider } from '@/lib/providers/llm';
import { searchTavily } from '@/lib/providers/tavily';
import type { Source } from '@/lib/types';

// One interface over Tavily + Exa. The real provider runs both in parallel,
// merges, and collapses duplicates (exact URL, then embedding near-duplicate).

export interface SearchProvider {
  search(query: string): Promise<Source[]>;
}

/** Above this cosine similarity two sources are treated as near-duplicates. */
export const DEFAULT_NEAR_DUPLICATE_THRESHOLD = 0.92;

export interface SearchProviderConfig {
  searchTavily: (query: string) => Promise<Source[]>;
  searchExa: (query: string) => Promise<Source[]>;
  embed: (texts: string[]) => Promise<number[][]>;
  threshold?: number;
}

export function createSearchProvider(config: SearchProviderConfig): SearchProvider {
  const threshold = config.threshold ?? DEFAULT_NEAR_DUPLICATE_THRESHOLD;

  return {
    async search(query: string): Promise<Source[]> {
      const [tavily, exa] = await Promise.allSettled([
        config.searchTavily(query),
        config.searchExa(query),
      ]);

      const merged: Source[] = [];
      if (tavily.status === 'fulfilled') merged.push(...tavily.value);
      else console.warn('searchProvider: Tavily failed', tavily.reason);
      if (exa.status === 'fulfilled') merged.push(...exa.value);
      else console.warn('searchProvider: Exa failed', exa.reason);

      // Surface total failure instead of silently returning nothing.
      if (tavily.status === 'rejected' && exa.status === 'rejected') {
        throw new Error('All search providers failed');
      }

      const byUrl = dedupeByUrl(merged);
      if (byUrl.length <= 1) return byUrl;

      // Keep the most relevant member of each near-duplicate cluster.
      const ranked = [...byUrl].sort((a, b) => b.rawRelevance - a.rawRelevance);
      try {
        const embeddings = await config.embed(ranked.map((s) => `${s.title}\n${s.snippet}`));
        return dedupeByEmbedding(ranked, embeddings, threshold);
      } catch (err) {
        // Embedding is an enhancement; URL-deduped results are still valid.
        console.warn('searchProvider: embedding dedupe skipped', err);
        return ranked;
      }
    },
  };
}

/** Builds the fused provider from environment secrets. Embeddings come from the
 *  shared llmProvider so search and the rest of the pipeline use one model. */
export function searchProviderFromEnv(llm: LlmProvider): SearchProvider {
  const env = getEnv();
  return createSearchProvider({
    searchTavily: (query) => searchTavily(query, { apiKey: env.TAVILY_API_KEY }),
    searchExa: (query) => searchExa(query, { apiKey: env.EXA_API_KEY }),
    embed: (texts) => llm.embed(texts),
  });
}
