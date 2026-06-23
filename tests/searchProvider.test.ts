import { describe, expect, it } from 'vitest';
import { createSearchProvider } from '@/lib/providers/search';
import type { Source } from '@/lib/types';

const src = (url: string, snippet: string, rawRelevance: number): Source => ({
  url,
  title: 't',
  snippet,
  rawRelevance,
});

// Deterministic stand-in for real embeddings: 'x' snippets point one way, 'y'
// the other, so near-duplicate collapse is predictable.
const embed = async (texts: string[]): Promise<number[][]> =>
  texts.map((t) => (t.includes('x') ? [1, 0] : t.includes('y') ? [0, 1] : [0, 0]));

describe('createSearchProvider', () => {
  it('fuses both providers, dropping exact-URL and embedding near-duplicates', async () => {
    const provider = createSearchProvider({
      searchTavily: async () => [
        src('https://a.org/1', 'x', 0.9),
        src('https://b.org/2', 'x', 0.8),
      ],
      searchExa: async () => [src('https://a.org/1', 'x', 0.95), src('https://c.org/3', 'y', 0.7)],
      embed,
    });

    const out = await provider.search('q');
    // a.org/1 collapsed by URL; b.org/2 is an embedding near-dup of it; c.org/3 survives.
    expect(out.map((s) => s.url)).toEqual(['https://a.org/1', 'https://c.org/3']);
  });

  it('returns the surviving provider when the other errors', async () => {
    const provider = createSearchProvider({
      searchTavily: async () => {
        throw new Error('tavily down');
      },
      searchExa: async () => [src('https://c.org/3', 'y', 0.7)],
      embed,
    });

    const out = await provider.search('q');
    expect(out.map((s) => s.url)).toEqual(['https://c.org/3']);
  });

  it('throws when both providers fail', async () => {
    const provider = createSearchProvider({
      searchTavily: async () => {
        throw new Error('down');
      },
      searchExa: async () => {
        throw new Error('down');
      },
      embed,
    });

    await expect(provider.search('q')).rejects.toThrow('All search providers failed');
  });

  it('falls back to URL-deduped results when embedding fails', async () => {
    const provider = createSearchProvider({
      searchTavily: async () => [
        src('https://a.org/1', 'x', 0.9),
        src('https://b.org/2', 'x', 0.8),
      ],
      searchExa: async () => [],
      embed: async () => {
        throw new Error('embed down');
      },
    });

    const out = await provider.search('q');
    expect(out.map((s) => s.url).sort()).toEqual(['https://a.org/1', 'https://b.org/2']);
  });
});
