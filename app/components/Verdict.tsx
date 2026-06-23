import { trustTier, type TrustTier } from '@/lib/trust';
import type { ScoredSource, VerifiedAnswer } from '@/lib/types';

// The hero of a result: a bold confidence verdict derived from how many
// independent high-trust sources corroborate the answer and how many claims the
// verifier flagged. This is the trust-native move Perplexity does not make, so it
// leads the answer rather than sitting underneath it.

const TONE: Record<TrustTier, { band: string; dot: string; text: string; label: string }> = {
  high: {
    band: 'bg-trust-high/10',
    dot: 'bg-trust-high',
    text: 'text-trust-high',
    label: 'High confidence',
  },
  mid: {
    band: 'bg-trust-mid/10',
    dot: 'bg-trust-mid',
    text: 'text-trust-mid',
    label: 'Moderate confidence',
  },
  low: {
    band: 'bg-trust-low/10',
    dot: 'bg-trust-low',
    text: 'text-trust-low',
    label: 'Low confidence',
  },
};

function confidenceTier(highCount: number, maxCorroboration: number): TrustTier {
  if (highCount >= 2 && maxCorroboration >= 2) return 'high';
  if (highCount >= 1 || maxCorroboration >= 1) return 'mid';
  return 'low';
}

export function Verdict({
  sources,
  verified,
  streaming,
}: {
  sources: ScoredSource[];
  verified: VerifiedAnswer | null;
  streaming: boolean;
}) {
  const highCount = sources.filter((s) => trustTier(s.trustScore) === 'high').length;
  const maxCorroboration = sources.reduce((m, s) => Math.max(m, s.corroborations), 0);
  const tier = confidenceTier(highCount, maxCorroboration);
  const tone = TONE[tier];

  const flagged = verified ? verified.unsupported.length : null;

  const support =
    highCount > 0
      ? `${highCount} independent high-trust source${highCount > 1 ? 's' : ''}`
      : `${sources.length} source${sources.length === 1 ? '' : 's'}, none high-trust`;
  const checkLine =
    flagged === null
      ? streaming
        ? 'checking claims…'
        : ''
      : flagged === 0
        ? 'every claim supported'
        : `${flagged} claim${flagged > 1 ? 's' : ''} flagged for review`;

  return (
    <div className={`flex items-center gap-3 rounded-card ${tone.band} px-4 py-3`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${tone.text}`}>{tone.label}</p>
        <p className="font-mono text-xs text-muted">
          {support}
          {checkLine ? ` · ${checkLine}` : ''}
        </p>
      </div>
    </div>
  );
}
