import type { TrustTier } from '@/lib/trust';

// A circular credibility gauge: the source's trust score as a filled arc, colored
// by tier. The prominent element on a scorecard, so trust reads at a glance.

const STROKE: Record<TrustTier, string> = {
  high: '#0F766E',
  mid: '#CA8A04',
  low: '#C2410C',
};

export function ScoreRing({ score, tier }: { score: number; tier: TrustTier }) {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 44 44"
      role="img"
      aria-label={`Trust score ${score} of 100`}
    >
      <circle cx="22" cy="22" r={radius} fill="none" stroke="#E6E8EB" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke={STROKE[tier]}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 22 22)"
      />
      <text
        x="22"
        y="22"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-ink font-mono"
        fontSize="13"
        fontWeight="600"
      >
        {score}
      </text>
    </svg>
  );
}
