import type { Source } from '@/lib/types';

// Trust score, reason, and corroboration badge are intentionally absent here;
// they arrive with the trust UI in #14. This card stays to url/title/snippet.

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function SourceCard({ index, source }: { index: number; source: Source }) {
  const domain = domainOf(source.url);
  const monogram = (domain[0] ?? '?').toUpperCase();

  return (
    <li className="animate-reveal rounded-card border border-hairline bg-surface p-4 shadow-card">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block focus-visible:outline-none"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded bg-accent/10 font-mono text-[10px] font-semibold text-accent"
          >
            {monogram}
          </span>
          <span className="truncate font-mono text-xs text-muted">{domain}</span>
          <span className="ml-auto font-mono text-xs text-muted">[{index}]</span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-medium text-ink group-hover:text-accent">
          {source.title}
        </h3>
        {source.snippet ? (
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted">{source.snippet}</p>
        ) : null}
      </a>
    </li>
  );
}
