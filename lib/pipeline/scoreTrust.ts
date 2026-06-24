import type { ScoredSource, Source } from '@/lib/types';
import { domainPrior, hostOf } from './domainPrior';
import { evidenceBonus, evidenceLabel, type EvidenceLevel } from './evidence';

// TrustRank-style score = domain prior (the dominant signal) + corroboration
// across independent domains (#12) + recency. Pure given precomputed signals, so
// the scoring math is unit tested against a hand-labeled set (#13). The pipeline
// computes the embedding-based corroboration and recency, then calls this.

export interface TrustSignals {
  /** url -> number of independent domains that corroborate it (#12). */
  corroboratingDomains?: Record<string, number>;
  /** url -> age in days, when the source reports a publish date (recency). */
  ageDays?: Record<string, number>;
  /** url -> detected evidence level (#54). */
  evidenceLevels?: Record<string, EvidenceLevel>;
}

const CORROBORATION_PER_DOMAIN = 5;
const CORROBORATION_CAP = 20;

function corroborationBonus(domains: number): number {
  return Math.min(CORROBORATION_CAP, domains * CORROBORATION_PER_DOMAIN);
}

function recencyBonus(ageDays: number | undefined): number {
  if (ageDays === undefined || Number.isNaN(ageDays)) return 0;
  if (ageDays <= 180) return 5;
  if (ageDays <= 365) return 2;
  if (ageDays >= 365 * 4) return -5;
  return 0;
}

function priorTier(prior: number): string {
  if (prior >= 80) return 'High-credibility domain';
  if (prior <= 45) return 'Low domain prior';
  return 'Moderate domain prior';
}

function buildReason(
  host: string,
  prior: number,
  corroborations: number,
  ageDays: number | undefined,
  level: EvidenceLevel | undefined,
): string {
  const parts = [`${priorTier(prior)} (${host})`];
  parts.push(
    corroborations > 0
      ? `corroborated by ${corroborations} independent domain${corroborations > 1 ? 's' : ''}`
      : 'not yet corroborated',
  );
  if (ageDays !== undefined && !Number.isNaN(ageDays)) {
    if (ageDays <= 365) parts.push('recent');
    else if (ageDays >= 365 * 4) parts.push('older source');
  }
  const base = parts.join(', ');
  return level ? `${evidenceLabel(level)} · ${base}` : base;
}

export function scoreTrust(sources: Source[], signals: TrustSignals = {}): ScoredSource[] {
  return sources
    .map((source) => {
      const host = hostOf(source.url) || 'unknown source';
      const prior = domainPrior(source.url);
      const corroborations = signals.corroboratingDomains?.[source.url] ?? 0;
      const ageDays = signals.ageDays?.[source.url];
      const level = signals.evidenceLevels?.[source.url];

      const raw =
        prior +
        corroborationBonus(corroborations) +
        recencyBonus(ageDays) +
        (level ? evidenceBonus(level) : 0);
      const trustScore = Math.round(Math.min(100, Math.max(0, raw)));

      return {
        ...source,
        trustScore,
        trustReason: buildReason(host, prior, corroborations, ageDays, level),
        corroborations,
        evidence: level ? evidenceLabel(level) : undefined,
      };
    })
    .sort((a, b) => b.trustScore - a.trustScore);
}
