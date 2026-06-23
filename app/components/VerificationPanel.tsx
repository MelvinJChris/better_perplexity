import type { VerifiedAnswer } from '@/lib/types';

// Surfaces the verification pass (#15). Status is carried by glyph + label +
// text, never color alone. A scope-mismatch banner is distinct from the
// unsupported-sentence list; each flagged sentence discloses why on selection.

function WarnGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        d="M8 2l6 11H2L8 2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 6.5v3M8 11.2h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      className={className}
      aria-hidden
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M5 8.3l2 2 4-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ScopeBanner({ note }: { note: string }) {
  return (
    <div
      role="note"
      className="flex animate-reveal gap-2 rounded-card border border-trust-low/40 bg-trust-low/5 p-3 text-sm text-ink"
    >
      <span className="mt-0.5 shrink-0 text-trust-low">
        <WarnGlyph />
      </span>
      <p>
        <span className="font-medium">Scope check:</span> {note}
      </p>
    </div>
  );
}

export function VerificationPanel({ verified }: { verified: VerifiedAnswer }) {
  const { unsupported } = verified;

  if (unsupported.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-card border border-hairline bg-surface p-3 text-sm text-muted">
        <span className="shrink-0 text-trust-high">
          <CheckGlyph />
        </span>
        Every sentence is backed by a high-trust source.
      </div>
    );
  }

  return (
    <div className="animate-reveal rounded-card border border-trust-low/40 bg-trust-low/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <span className="shrink-0 text-trust-low">
          <WarnGlyph />
        </span>
        {unsupported.length} sentence{unsupported.length > 1 ? 's' : ''} not matched to a high-trust
        source
      </p>
      <ul className="mt-2 space-y-1.5">
        {unsupported.map((sentence) => (
          <li key={sentence}>
            <details className="group">
              <summary className="cursor-pointer list-none text-sm text-ink">
                <span className="font-mono text-xs font-semibold text-trust-low">!</span> {sentence}
              </summary>
              <p className="mt-1 pl-5 text-xs leading-relaxed text-muted">
                No high-trust source substantively supports this claim. Treat it with caution and
                check the sources directly.
              </p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
