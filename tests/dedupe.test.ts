import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  dedupeByEmbedding,
  dedupeByUrl,
  normalizeUrl,
} from '@/lib/pipeline/dedupe';
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

describe('cosineSimilarity', () => {
  it('is 1 for identical, 0 for orthogonal, -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
  });

  it('returns 0 for mismatched-length or zero-magnitude vectors', () => {
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('dedupeByEmbedding', () => {
  it('collapses sources at or above the threshold, keeping the first', () => {
    const sources = [src('https://a.org/1'), src('https://b.org/2'), src('https://c.org/3')];
    const embeddings = [
      [1, 0],
      [0.99, 0.01],
      [0, 1],
    ];
    const out = dedupeByEmbedding(sources, embeddings, 0.95);
    expect(out.map((s) => s.url)).toEqual(['https://a.org/1', 'https://c.org/3']);
  });

  it('keeps sources below the threshold', () => {
    const sources = [src('https://a.org/1'), src('https://b.org/2')];
    const embeddings = [
      [1, 0],
      [0.5, 0.5],
    ];
    expect(dedupeByEmbedding(sources, embeddings, 0.95)).toHaveLength(2);
  });
});
