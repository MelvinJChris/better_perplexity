import type { Source } from '@/lib/types';

/** Normalizes a URL for exact-duplicate comparison: lowercased host, no hash,
 *  no trailing slash, tracking params dropped. Near-duplicate detection by
 *  embedding is separate (see dedupeByEmbedding below). */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'ref' || key === 'fbclid') {
        u.searchParams.delete(key);
      }
    }
    let out = u.toString();
    if (out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch {
    return url.trim();
  }
}

/** Keeps the first source for each normalized URL, preserving order. */
export function dedupeByUrl(sources: Source[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const source of sources) {
    const key = normalizeUrl(source.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

/** Cosine similarity of two equal-length vectors, in [-1, 1]. Returns 0 for
 *  mismatched, empty, or zero-magnitude vectors (no meaningful direction). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Collapses near-duplicate sources whose embeddings are at least `threshold`
 *  similar. `embeddings[i]` pairs with `sources[i]`; the first member of each
 *  near-duplicate cluster is kept, so order the inputs by priority (for example
 *  rawRelevance descending) before calling. */
export function dedupeByEmbedding(
  sources: Source[],
  embeddings: number[][],
  threshold: number,
): Source[] {
  const kept: Source[] = [];
  const keptEmbeddings: number[][] = [];
  for (let i = 0; i < sources.length; i += 1) {
    const embedding = embeddings[i] ?? [];
    const isDuplicate = keptEmbeddings.some(
      (existing) => cosineSimilarity(existing, embedding) >= threshold,
    );
    if (isDuplicate) continue;
    kept.push(sources[i]);
    keptEmbeddings.push(embedding);
  }
  return kept;
}
