import { trustTier, type TrustTier } from '@/lib/trust';

// Trust is encoded by the number, a bar with fill, and an icon shape, never by
// color alone (issue #27). The score text stays high-contrast ink for AA; the
// tier color is carried only by the bar and the (aria-labelled) icon.

const TIER: Record<TrustTier, { bar: string; icon: string; label: string }> = {
  high: { bar: 'bg-trust-high', icon: 'text-trust-high', label: 'High trust' },
  mid: { bar: 'bg-trust-mid', icon: 'text-trust-mid', label: 'Medium trust' },
  low: { bar: 'bg-trust-low', icon: 'text-trust-low', label: 'Low trust' },
};

function TierIcon({ tier, className }: { tier: TrustTier; className?: string }) {
  // check (high), minus (mid), exclamation (low) so shape carries the tier.
  const path =
    tier === 'high' ? 'M5 8.5l2 2 4-4.5' : tier === 'mid' ? 'M5 8h6' : 'M8 4.5v4M8 11h.01';
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      className={className}
      aria-hidden
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrustMeter({ score }: { score: number }) {
  const tier = trustTier(score);
  const t = TIER[tier];
  return (
    <div className="flex items-center gap-1.5" title={`${t.label}: ${score} of 100`}>
      <span className={t.icon}>
        <TierIcon tier={tier} />
      </span>
      <span className="sr-only">{t.label}.</span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-hairline" aria-hidden>
        <div className={`h-full ${t.bar}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-xs font-semibold text-ink">{score}</span>
    </div>
  );
}
