import { extractMetricValue } from '@/lib/metrics';
import { hostOf } from '@/lib/pipeline/domainPrior';
import type { ScoredSource, Source } from '@/lib/types';

// Pure scoring helpers for the eval harness (#17). Kept here, separate from the
// run.ts I/O, so the metric math is unit-tested. The harness runs offline against
// a hand-labeled dataset, so corroboration is approximated from comparable
// numbers (no embeddings/keys) rather than the live embedding path.

/** Offline corroboration proxy: count independent domains whose extracted metric
 *  is within `tolerance` (fractional) of this source's. Same-domain and
 *  number-less sources never corroborate. */
export function corroborationProxy(sources: Source[], tolerance = 0.1): Record<string, number> {
  const domains = sources.map((s) => hostOf(s.url));
  const values = sources.map((s) => extractMetricValue(`${s.title} ${s.snippet}`));
  const out: Record<string, number> = {};

  sources.forEach((source, i) => {
    const value = values[i];
    if (value === null) {
      out[source.url] = 0;
      return;
    }
    const agreeing = new Set<string>();
    for (let j = 0; j < sources.length; j += 1) {
      const other = values[j];
      if (i === j || other === null || !domains[j] || domains[j] === domains[i]) continue;
      const scale = Math.max(Math.abs(value), Math.abs(other)) || 1;
      if (Math.abs(value - other) <= tolerance * scale) agreeing.add(domains[j]);
    }
    out[source.url] = agreeing.size;
  });
  return out;
}

/** Fraction of expected high-trust domains that land in the top K of the ranking
 *  (K defaults to the number of expected domains). */
export function precisionAtK(
  ranked: ScoredSource[],
  expectedDomains: string[],
  k?: number,
): number {
  if (expectedDomains.length === 0) return 1;
  const topK = ranked.slice(0, k ?? expectedDomains.length).map((s) => hostOf(s.url));
  const hits = expectedDomains.filter((d) =>
    topK.some((t) => t === d || t.endsWith(`.${d}`)),
  ).length;
  return hits / expectedDomains.length;
}

/** A labeled contradiction is "recalled" when its outlier source ranks in the
 *  bottom half or is left uncorroborated. */
export function contradictionDetected(ranked: ScoredSource[], outlierUrl: string): boolean {
  const idx = ranked.findIndex((s) => s.url === outlierUrl);
  if (idx === -1) return false;
  const inBottomHalf = idx >= Math.ceil(ranked.length / 2);
  return inBottomHalf || ranked[idx].corroborations === 0;
}
