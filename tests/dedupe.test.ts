import { describe, expect, it } from 'vitest';
import { dedupeByUrl, normalizeUrl } from '@/lib/pipeline/dedupe';
import type { Source } from '@/lib/types';

const src = (url: string): Source => ({
  url,
  title: 't',
  snippet: 's',
  rawRelevance: 1,
});

describe('normalizeUrl', () => {
  it('ignores www, hash, trailing slash, and tracking params', () => {
    expect(normalizeUrl('https://www.iea.org/x/?utm_source=news#frag')).toBe('https://iea.org/x');
  });
});

describe('dedupeByUrl', () => {
  it('collapses URLs that differ only by tracking noise, keeping the first', () => {
    const out = dedupeByUrl([
      src('https://iea.org/a'),
      src('https://www.iea.org/a/?utm_campaign=z'),
      src('https://iea.org/b'),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.url)).toEqual(['https://iea.org/a', 'https://iea.org/b']);
  });
});
