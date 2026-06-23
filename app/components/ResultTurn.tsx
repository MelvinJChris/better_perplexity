import type { GraphClaim } from '@/lib/pipeline/contradictionGraph';
import type { QueryTrace } from '@/lib/trace/trace';
import type { ScoredSource, VerifiedAnswer } from '@/lib/types';
import { AnswerBlock } from './AnswerBlock';
import { CorroborationSpectrum } from './CorroborationSpectrum';
import { DisputedView } from './DisputedView';
import { SourceList } from './SourceList';
import { TrustSummary } from './TrustSummary';
import { ScopeBanner, VerificationPanel } from './VerificationPanel';

export interface Turn {
  id: number;
  query: string;
  status: 'streaming' | 'done' | 'error';
  sources: ScoredSource[];
  answer: string;
  verified: VerifiedAnswer | null;
  contradictions: GraphClaim[][];
  followups: string[];
  trace: QueryTrace | null;
  error: string;
}

function Eyebrow({ children }: { children: string }) {
  return (
    <h2 className="font-mono text-xs font-medium uppercase tracking-widest text-accent">
      {children}
    </h2>
  );
}

export function ResultTurn({
  turn,
  onFollowup,
  onRetry,
}: {
  turn: Turn;
  onFollowup: (query: string) => void;
  onRetry: (query: string) => void;
}) {
  const streaming = turn.status === 'streaming';

  if (turn.status === 'error') {
    return (
      <article className="animate-reveal border-t border-hairline pt-6 first:border-t-0 first:pt-0">
        <h1 className="text-lg font-semibold tracking-tight text-ink">{turn.query}</h1>
        <div
          role="alert"
          className="mt-4 rounded-card border border-trust-low/40 bg-trust-low/5 p-4 text-sm text-ink"
        >
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1 text-muted">{turn.error}</p>
          <button
            type="button"
            onClick={() => onRetry(turn.query)}
            className="mt-3 rounded-card border border-hairline bg-surface px-3 py-1.5 text-sm hover:border-accent"
          >
            Try again
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="animate-reveal border-t border-hairline pt-6 first:border-t-0 first:pt-0">
      <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{turn.query}</h1>

      {/* Answer first: the prose plus a trust verdict, in a prominent card. */}
      <section
        aria-label="Answer"
        className="mt-4 rounded-card border border-hairline bg-surface p-5 shadow-card"
      >
        <div className="border-l-2 border-accent pl-3">
          <TrustSummary sources={turn.sources} verified={turn.verified} streaming={streaming} />
        </div>

        <div className="mt-4 space-y-3">
          {turn.verified?.scopeMismatch ? <ScopeBanner note={turn.verified.scopeMismatch} /> : null}
          {turn.answer ? (
            <AnswerBlock text={turn.answer} streaming={streaming} />
          ) : streaming ? (
            <p className="text-sm text-muted">Synthesizing a cited answer…</p>
          ) : (
            <p className="text-sm text-muted">No answer was produced.</p>
          )}
          {turn.verified ? <VerificationPanel verified={turn.verified} /> : null}
        </div>
      </section>

      {turn.followups.length > 0 ? (
        <section aria-label="Follow-up questions" className="mt-6">
          <Eyebrow>Keep digging</Eyebrow>
          <ul className="mt-3 flex flex-wrap gap-2">
            {turn.followups.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => onFollowup(q)}
                  className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm text-ink shadow-card transition-colors hover:border-accent hover:text-accent"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Sources" className="mt-6">
        <Eyebrow>
          {turn.sources.length > 0 ? `Sources · ${turn.sources.length}` : 'Sources'}
        </Eyebrow>
        <div className="mt-3 space-y-4">
          {turn.sources.length > 0 ? (
            <>
              <CorroborationSpectrum sources={turn.sources} />
              <SourceList sources={turn.sources} />
            </>
          ) : streaming ? (
            <p className="text-sm text-muted">Searching the web…</p>
          ) : (
            <p className="text-sm text-muted">No sources found for this query.</p>
          )}
        </div>
      </section>

      {turn.contradictions.length > 0 ? (
        <div className="mt-6">
          <DisputedView groups={turn.contradictions} sources={turn.sources} />
        </div>
      ) : null}

      {turn.trace ? (
        <p className="mt-6 font-mono text-xs text-muted">
          {turn.trace.sourceCount} sources · {turn.trace.latencyMs} ms ·{' '}
          {turn.trace.inputTokens + turn.trace.outputTokens} tokens · {turn.trace.synthesisModel}
        </p>
      ) : null}
    </article>
  );
}
