// Evidence-level signal (#54): infer where a clinical source sits on the evidence
// pyramid from its text, so a meta-analysis outranks a mouse study even on an
// equally credible domain. Deterministic keyword detection (no LLM), so it is
// unit-tested; it feeds scoreTrust and shows as a badge on the scorecard. This is
// the healthcare-native move a generic answer engine does not make.

export type EvidenceLevel =
  | 'systematic-review'
  | 'rct'
  | 'observational'
  | 'case-report'
  | 'preclinical'
  | 'expert-opinion';

// Ordered high to low; the first pattern that matches wins (a meta-analysis of
// RCTs reads as a systematic review, the stronger claim).
const PATTERNS: ReadonlyArray<readonly [EvidenceLevel, RegExp]> = [
  [
    'systematic-review',
    /\b(systematic review|meta[- ]analysis|cochrane review|pooled analysis)\b/i,
  ],
  [
    'rct',
    /\b(randomi[sz]ed[- ]controlled trial|randomi[sz]ed trial|\bRCTs?\b|double[- ]blind|placebo[- ]controlled)\b/i,
  ],
  [
    'observational',
    /\b(cohort study|case[- ]control|observational study|prospective study|longitudinal study|cross[- ]sectional)\b/i,
  ],
  ['case-report', /\b(case report|case series)\b/i],
  ['preclinical', /\b(in vitro|in vivo|animal study|mouse model|murine|rat study|cell culture)\b/i],
  [
    'expert-opinion',
    /\b(expert opinion|editorial|commentary|narrative review|consensus statement)\b/i,
  ],
];

const LABEL: Record<EvidenceLevel, string> = {
  'systematic-review': 'Systematic review',
  rct: 'Randomized trial',
  observational: 'Observational',
  'case-report': 'Case report',
  preclinical: 'Preclinical',
  'expert-opinion': 'Expert opinion',
};

// Trust adjustment by strength of evidence (clamped later in scoreTrust).
const BONUS: Record<EvidenceLevel, number> = {
  'systematic-review': 10,
  rct: 7,
  observational: 2,
  'case-report': -2,
  preclinical: -3,
  'expert-opinion': 0,
};

export function detectEvidenceLevel(text: string): EvidenceLevel | null {
  for (const [level, pattern] of PATTERNS) {
    if (pattern.test(text)) return level;
  }
  return null;
}

export function evidenceLabel(level: EvidenceLevel): string {
  return LABEL[level];
}

export function evidenceBonus(level: EvidenceLevel): number {
  return BONUS[level];
}
