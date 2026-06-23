import { extractMetricValue } from '@/lib/metrics';
import { trustTier, type TrustTier } from '@/lib/trust';
import type { ScoredSource } from '@/lib/types';

// The signature element: plot each source's comparable number on one axis so the
// agreeing cluster clumps and outliers sit apart (the US-vs-global scope trap is
// visible spatially). Degrades to nothing when fewer than two sources expose a
// comparable number.

const DOT: Record<TrustTier, string> = {
  high: 'bg-trust-high',
  mid: 'bg-trust-mid',
  low: 'bg-trust-low',
};

function formatValue(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  return value.toLocaleString('en-US');
}

export function CorroborationSpectrum({ sources }: { sources: ScoredSource[] }) {
  const points = sources
    .map((source, i) => ({
      source,
      index: i + 1,
      value: extractMetricValue(`${source.title} ${source.snippet}`),
    }))
    .filter((p): p is { source: ScoredSource; index: number; value: number } => p.value !== null);

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return (
    <figure className="animate-reveal rounded-card border border-hairline bg-surface p-4 shadow-card">
      <figcaption className="font-mono text-xs uppercase tracking-widest text-muted">
        Corroboration spectrum
      </figcaption>
      <p className="mt-1 text-xs text-muted">
        Comparable values across sources. Agreement clusters; outliers sit apart.
      </p>

      <div className="relative mb-6 mt-6 h-px bg-hairline">
        {points.map((p) => {
          const left = ((p.value - min) / span) * 100;
          return (
            <div
              key={p.source.url}
              className="absolute top-0 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%` }}
              title={`[${p.index}] ${p.source.title}: ${formatValue(p.value)}`}
            >
              <span
                className={`block h-2.5 w-2.5 rounded-full ${DOT[trustTier(p.source.trustScore)]}`}
              />
              <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-muted">
                {formatValue(p.value)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between font-mono text-[10px] text-muted">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </figure>
  );
}
