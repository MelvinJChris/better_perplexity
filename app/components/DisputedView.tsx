import type { GraphClaim } from '@/lib/pipeline/contradictionGraph';
import { cleanSnippet } from '@/lib/snippet';
import { trustTier, type TrustTier } from '@/lib/trust';
import type { ScoredSource } from '@/lib/types';

// Consensus vs disputed (#19): claims about the same point that disagree, with a
// drill to the source on each side. Consensus itself is already conveyed by the
// corroboration spectrum and the trust-ranked cards, so this surfaces the
// contested claims, in the shared visual language (no one-off styles).

const DOT: Record<TrustTier, string> = {
  high: 'bg-trust-high',
  mid: 'bg-trust-mid',
  low: 'bg-trust-low',
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatValue(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  return value.toLocaleString('en-US');
}

export function DisputedView({
  groups,
  sources,
}: {
  groups: GraphClaim[][];
  sources: ScoredSource[];
}) {
  if (groups.length === 0) return null;
  const byUrl = new Map(sources.map((s) => [s.url, s]));

  return (
    <section aria-label="Disputed claims" className="animate-reveal">
      <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
        Consensus vs disputed
      </h2>
      <p className="mt-1 text-xs text-muted">
        Sources on the same point that disagree. Consensus is shown by the corroboration spectrum
        and the trust-ranked sources above.
      </p>

      <div className="mt-3 space-y-3">
        {groups.map((group, gi) => {
          const sorted = [...group].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
          return (
            <div
              key={gi}
              className="space-y-2 rounded-card border border-trust-low/30 bg-trust-low/5 p-3"
            >
              {sorted.map((claim) => {
                const source = byUrl.get(claim.sourceUrl);
                const tier = source ? trustTier(source.trustScore) : 'mid';
                return (
                  <div key={claim.id} className="flex items-start gap-2 text-sm">
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[tier]}`}
                    />
                    {claim.value !== null ? (
                      <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-ink">
                        {formatValue(claim.value)}
                      </span>
                    ) : null}
                    <a
                      href={claim.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 hover:text-accent"
                    >
                      <span className="font-mono text-xs text-muted">
                        {domainOf(claim.sourceUrl)}
                      </span>
                      <span className="block text-ink">{cleanSnippet(claim.text)}</span>
                    </a>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
