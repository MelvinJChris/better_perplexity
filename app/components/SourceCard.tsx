import { trustTier, type TrustTier } from '@/lib/trust';
import type { ScoredSource } from '@/lib/types';
import { TrustMeter } from './TrustMeter';

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

function CorroborationBadge({ count }: { count: number }) {
  return (
    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-trust-high/10 px-2 py-0.5 text-xs text-trust-high">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden focusable="false">
        <path
          d="M6 10a3 3 0 010-4M10 6a3 3 0 010 4M6.5 8h3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-mono">{count}</span> independent {count === 1 ? 'domain' : 'domains'}{' '}
      agree
    </span>
  );
}

export function SourceCard({ index, source }: { index: number; source: ScoredSource }) {
  const domain = domainOf(source.url);
  const tier = trustTier(source.trustScore);
  const deemphasized = tier === 'low';

  return (
    <li
      className={`animate-reveal rounded-card border border-l-4 border-hairline bg-surface p-4 shadow-card ${
        TIER_BORDER[tier]
      } ${deemphasized ? 'opacity-75' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
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
        <TrustMeter score={source.trustScore} />
      </div>

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block text-sm font-medium text-ink hover:text-accent"
      >
        <span className="line-clamp-2">{source.title}</span>
      </a>

      <p className="mt-1 text-xs leading-relaxed text-muted">{source.trustReason}</p>

      {source.corroborations > 0 ? <CorroborationBadge count={source.corroborations} /> : null}

      {source.snippet ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{source.snippet}</p>
      ) : null}
    </li>
  );
}
