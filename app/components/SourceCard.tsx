import { sourceKind } from '@/lib/pipeline/domainPrior';
import { cleanSnippet } from '@/lib/snippet';
import { trustTier, type TrustTier } from '@/lib/trust';
import type { ScoredSource } from '@/lib/types';
import { ScoreRing } from './ScoreRing';

// A credibility scorecard, not a neutral search result: the trust score (ring)
// and the source's kind lead, with cross-source corroboration called out.

const TIER_BORDER: Record<TrustTier, string> = {
  high: 'border-l-trust-high',
  mid: 'border-l-trust-mid',
  low: 'border-l-trust-low',
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function SourceCard({ index, source }: { index: number; source: ScoredSource }) {
  const domain = domainOf(source.url);
  const tier = trustTier(source.trustScore);

  return (
    <li
      className={`animate-reveal rounded-card border border-l-4 border-hairline bg-surface p-4 shadow-card ${
        TIER_BORDER[tier]
      } ${tier === 'low' ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-accent/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                alt=""
                width={16}
                height={16}
                loading="lazy"
              />
            </span>
            <span className="truncate font-mono text-xs text-muted">{domain}</span>
            <span className="shrink-0 font-mono text-xs text-muted">[{index}]</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-ink">{sourceKind(source.url)}</span>
            {source.evidence ? (
              <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                {source.evidence}
              </span>
            ) : null}
          </div>
        </div>
        <ScoreRing score={source.trustScore} tier={tier} />
      </div>

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block text-sm font-medium text-ink hover:text-accent"
      >
        <span className="line-clamp-2">{source.title}</span>
      </a>

      {source.corroborations > 0 ? (
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-trust-high/10 px-2 py-0.5 text-xs text-trust-high">
          <span aria-hidden>▲</span>
          <span className="font-mono">{source.corroborations}</span> independent{' '}
          {source.corroborations === 1 ? 'domain agrees' : 'domains agree'}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">Not yet corroborated</p>
      )}

      {source.snippet ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
          {cleanSnippet(source.snippet)}
        </p>
      ) : null}
    </li>
  );
}
