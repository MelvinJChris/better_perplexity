import type { Claim, ScoredSource, Source } from '@/lib/types';
import { domainPrior, hostOf } from './domainPrior';

// Toy trust scorer: domain prior plus a small bonus when a source is one of
// several INDEPENDENT domains in the result set (a rough corroboration proxy).
// The embedding-measured corroboration and recency land in #13; this version
// is deterministic so it can be unit tested now.

export function scoreTrust(sources: Source[], _claims: Claim[] = []): ScoredSource[] {
  const distinctHosts = new Set(sources.map((s) => hostOf(s.url)).filter(Boolean));
  const independenceBonus = Math.min(10, Math.max(0, distinctHosts.size - 1) * 2);

  return sources
    .map((source) => {
      const prior = domainPrior(source.url);
      const trustScore = Math.round(Math.min(100, prior + independenceBonus));
      const host = hostOf(source.url) || 'unknown source';
      const trustReason =
        prior >= 80
          ? `High-credibility domain (${host})`
          : prior <= 45
            ? `Low domain prior (${host}); verify before relying on it`
            : `Moderate domain prior (${host})`;
      return { ...source, trustScore, trustReason };
    })
    .sort((a, b) => b.trustScore - a.trustScore);
}
