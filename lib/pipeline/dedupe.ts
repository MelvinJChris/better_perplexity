import type { Source } from '@/lib/types';

/** Normalizes a URL for exact-duplicate comparison: lowercased host, no hash,
 *  no trailing slash, tracking params dropped. Near-duplicate detection by
 *  embedding is separate (see #12). */
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
