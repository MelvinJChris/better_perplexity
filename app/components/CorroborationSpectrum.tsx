import { dominantUnit, extractMetric } from '@/lib/metrics';
import { trustTier, type TrustTier } from '@/lib/trust';
import type { ScoredSource } from '@/lib/types';

// The signature element: plot each source's comparable number on one axis so the
// agreeing cluster clumps and outliers sit apart. Nearby values are collapsed
// into a single labelled marker (otherwise a tight cluster overlaps into an
// unreadable blob), and labels are edge-aligned so they never collide. Only the
// dominant unit is plotted (#46). Degrades to nothing below two comparable values.

const DOT: Record<TrustTier, string> = {
  high: 'bg-trust-high',
  mid: 'bg-trust-mid',
  low: 'bg-trust-low',
};
const RANK: Record<TrustTier, number> = { high: 3, mid: 2, low: 1 };

function formatValue(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  return value.toLocaleString('en-US');
}

interface Point {
  value: number;
  tier: TrustTier;
}
interface Cluster {
  items: Point[];
  pos: number;
  min: number;
  max: number;
  tier: TrustTier;
}

export function CorroborationSpectrum({ sources }: { sources: ScoredSource[] }) {
  const unit = dominantUnit(sources.map((s) => `${s.title} ${s.snippet}`));
  if (!unit) return null;

  const points: Point[] = sources
    .map((s) => {
      const metric = extractMetric(`${s.title} ${s.snippet}`);
      return metric && metric.unit === unit
        ? { value: metric.value, tier: trustTier(s.trustScore) }
        : null;
    })
    .filter((p): p is Point => p !== null)
    .sort((a, b) => a.value - b.value);

  if (points.length < 2) return null;

  const min = points[0].value;
  const max = points[points.length - 1].value;
  const span = max - min || 1;
  const left = (value: number) => ((value - min) / span) * 100;

  // Collapse points whose positions are within GAP% into one cluster marker.
  const GAP = 6;
  const clusters: Cluster[] = [];
  for (const p of points) {
    const last = clusters[clusters.length - 1];
    if (last && left(p.value) - left(last.max) <= GAP) {
      last.items.push(p);
      last.max = p.value;
    } else {
      clusters.push({ items: [p], pos: 0, min: p.value, max: p.value, tier: p.tier });
    }
  }
  for (const c of clusters) {
    c.pos = left((c.min + c.max) / 2);
    c.tier = c.items.reduce<TrustTier>(
      (best, p) => (RANK[p.tier] > RANK[best] ? p.tier : best),
      'low',
    );
  }

  // Nothing to show when every value collapses into a single cluster: there is
  // no consensus-vs-outlier spread to plot (#68).
  if (clusters.length < 2) return null;

  return (
    <figure className="animate-reveal rounded-card border border-hairline bg-surface p-4 shadow-card">
      <figcaption className="font-mono text-xs uppercase tracking-widest text-muted">
        Corroboration spectrum ({unit})
      </figcaption>
      <p className="mt-1 text-xs text-muted">
        Comparable {unit} values across sources. Agreement clusters; outliers sit apart.
      </p>

      <div className="relative my-10 h-0.5 rounded-full bg-hairline">
        {clusters.map((c, i) => {
          const count = c.items.length;
          const width = Math.min(44, 12 + (count - 1) * 5);
          const label =
            count === 1
              ? formatValue(c.min)
              : `${formatValue(c.min)}–${formatValue(c.max)} ·${count}`;
          const align =
            i === 0
              ? 'left-0 text-left'
              : i === clusters.length - 1
                ? 'right-0 text-right'
                : 'left-1/2 -translate-x-1/2 text-center';

          return (
            <div
              key={`${c.min}-${c.max}`}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${c.pos}%` }}
              title={
                count === 1
                  ? `${formatValue(c.min)} ${unit}`
                  : `${count} sources, ${formatValue(c.min)} to ${formatValue(c.max)} ${unit}`
              }
            >
              <span
                className={`block h-2.5 rounded-full ${DOT[c.tier]}`}
                style={{ width: `${width}px` }}
              />
              <span
                className={`absolute top-4 whitespace-nowrap font-mono text-[10px] text-muted ${align}`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {clusters.length > 1 ? (
        <p className="font-mono text-[10px] text-muted">
          {clusters[0].items.length >= 2
            ? `consensus ${formatValue(clusters[0].min)}–${formatValue(clusters[0].max)} ${unit} · ${clusters.length - 1} outlier${clusters.length - 1 > 1 ? 's' : ''} apart`
            : `${clusters.length} distinct values`}
        </p>
      ) : null}
    </figure>
  );
}
