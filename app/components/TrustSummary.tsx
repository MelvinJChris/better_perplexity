import { trustTier, type TrustTier } from '@/lib/trust';
import type { ScoredSource, VerifiedAnswer } from '@/lib/types';

// The signature header on every answer: a stacked bar showing how the cited
// sources split across the trust ramp, plus the verification verdict. It puts the
// "how much should I trust this" answer above the prose, in the ramp's colors.

const SEGMENT: Record<TrustTier, { bg: string; label: string }> = {
  high: { bg: 'bg-trust-high', label: 'high' },
  mid: { bg: 'bg-trust-mid', label: 'medium' },
  low: { bg: 'bg-trust-low', label: 'low' },
};
const ORDER: TrustTier[] = ['high', 'mid', 'low'];

export function TrustSummary({
  sources,
  verified,
  streaming,
}: {
  sources: ScoredSource[];
  verified: VerifiedAnswer | null;
  streaming: boolean;
}) {
  const counts: Record<TrustTier, number> = { high: 0, mid: 0, low: 0 };
  for (const s of sources) counts[trustTier(s.trustScore)] += 1;
  const total = sources.length;

  const flagged = verified ? verified.unsupported.length : null;
  const verdict =
    flagged === null
      ? streaming
        ? 'Verifying…'
        : null
      : flagged === 0
        ? 'Every sentence supported'
        : `${flagged} claim${flagged > 1 ? 's' : ''} flagged`;
  const verdictTone =
    flagged === null ? 'text-muted' : flagged === 0 ? 'text-trust-high' : 'text-trust-low';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <div className="flex h-2 w-32 overflow-hidden rounded-full bg-hairline" aria-hidden>
          {total > 0
            ? ORDER.map((tier) =>
                counts[tier] > 0 ? (
                  <div
                    key={tier}
                    className={SEGMENT[tier].bg}
                    style={{ width: `${(counts[tier] / total) * 100}%` }}
                  />
                ) : null,
              )
            : null}
        </div>
        <span className="font-mono text-xs text-muted">
          {total} source{total === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
        {ORDER.filter((t) => counts[t] > 0).map((tier) => (
          <span key={tier} className="flex items-center gap-1 text-muted">
            <span className={`h-2 w-2 rounded-full ${SEGMENT[tier].bg}`} aria-hidden />
            {counts[tier]} {SEGMENT[tier].label}
          </span>
        ))}
      </div>

      {verdict ? <span className={`font-mono text-xs ${verdictTone}`}>{verdict}</span> : null}
    </div>
  );
}
