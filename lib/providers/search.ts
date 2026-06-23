import { notImplemented } from '@/lib/notImplemented';
import type { Source } from '@/lib/types';

// One interface over Tavily + Exa. The real provider fuses both and dedupes
// by URL and embedding near-duplicate (see #8).

export interface SearchProvider {
  search(query: string): Promise<Source[]>;
}

/** Placeholder until the Tavily + Exa provider lands in #8. */
export const stubSearchProvider: SearchProvider = {
  async search() {
    return notImplemented('searchProvider.search');
  },
};
