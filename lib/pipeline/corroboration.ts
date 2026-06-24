import { cosineSimilarity } from '@/lib/pipeline/dedupe';
import { hostOf } from '@/lib/pipeline/domainPrior';
import type { Source } from '@/lib/types';

// Cross-source agreement measured by embedding similarity. Corroboration only
// counts INDEPENDENT domains: a site agreeing with itself, or a syndicated copy
// on a sibling domain, must not inflate trust. The scoring math is deterministic
// given embeddings, so it is unit tested (see #12); feeds scoreTrust (#13).

// Same claim in different words: high but not identical similarity.
export const CORROBORATION_THRESHOLD = 0.82;
// Syndicated / near-identical copy: very high similarity.
export const NEAR_DUPLICATE_THRESHOLD = 0.95;

/** For each source, how many OTHER independent domains carry a source whose
 *  embedding agrees (cosine >= threshold). The source itself and same-domain
 *  matches never count, and each agreeing domain is counted once. */
export function countCorroboratingDomains(
  sources: Source[],
  embeddings: number[][],
  threshold: number = CORROBORATION_THRESHOLD,
): number[] {
  const domains = sources.map((s) => hostOf(s.url));
  return sources.map((_, i) => {
    if (!domains[i]) return 0;
    const agreeing = new Set<string>();
    for (let j = 0; j < sources.length; j += 1) {
      if (i === j || !domains[j] || domains[j] === domains[i]) continue;
      if (cosineSimilarity(embeddings[i] ?? [], embeddings[j] ?? []) >= threshold) {
        agreeing.add(domains[j]);
      }
    }
    return agreeing.size;
  });
}

/** Flags each source that is a near-duplicate (cosine >= threshold) of an
 *  earlier source, regardless of domain (catches syndicated copies). */
export function flagNearDuplicates(
  sources: Source[],
  embeddings: number[][],
  threshold: number = NEAR_DUPLICATE_THRESHOLD,
): boolean[] {
  const flags = sources.map(() => false);
  for (let i = 0; i < sources.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (cosineSimilarity(embeddings[i] ?? [], embeddings[j] ?? []) >= threshold) {
        flags[i] = true;
        break;
      }
    }
  }
  return flags;
}
