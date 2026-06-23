import type { QueryTrace } from '@/lib/trace/trace';
import type { ScoredSource, VerifiedAnswer } from '@/lib/types';
import { AnswerBlock } from './AnswerBlock';
import { SourceList } from './SourceList';
import { ScopeBanner, VerificationPanel } from './VerificationPanel';

export interface Turn {
  id: number;
  query: string;
  status: 'streaming' | 'done' | 'error';
  sources: ScoredSource[];
  answer: string;
  verified: VerifiedAnswer | null;
  followups: string[];
  trace: QueryTrace | null;
  error: string;
}

function Heading({ children }: { children: string }) {
  return <h2 className="font-mono text-xs uppercase tracking-widest text-muted">{children}</h2>;
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

  return (
    <article className="animate-reveal border-t border-hairline pt-6 first:border-t-0 first:pt-0">
      <h1 className="text-lg font-semibold tracking-tight text-ink">{turn.query}</h1>

      {turn.status === 'error' ? (
        <div
          role="alert"
          className="mt-4 rounded-card border border-trust-low/30 bg-trust-low/5 p-4 text-sm text-ink"
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
      ) : (
        <div className="mt-4 space-y-6">
          <section aria-label="Sources">
            <Heading>
              {turn.sources.length > 0 ? `Sources (${turn.sources.length})` : 'Sources'}
            </Heading>
            <div className="mt-3">
              {turn.sources.length > 0 ? (
                <SourceList sources={turn.sources} />
              ) : streaming ? (
                <p className="text-sm text-muted">Searching the web...</p>
              ) : (
                <p className="text-sm text-muted">No sources found for this query.</p>
              )}
            </div>
          </section>

          <section aria-label="Answer">
            <Heading>Answer</Heading>
            <div className="mt-3 space-y-3">
              {turn.verified?.scopeMismatch ? (
                <ScopeBanner note={turn.verified.scopeMismatch} />
              ) : null}
              {turn.answer ? (
                <AnswerBlock text={turn.answer} streaming={streaming} />
              ) : streaming ? (
                <p className="text-sm text-muted">Synthesizing a cited answer...</p>
              ) : (
                <p className="text-sm text-muted">No answer was produced.</p>
              )}
              {turn.verified ? <VerificationPanel verified={turn.verified} /> : null}
            </div>
          </section>

          {turn.followups.length > 0 ? (
            <section aria-label="Follow-up questions">
              <Heading>Follow up</Heading>
              <ul className="mt-3 flex flex-wrap gap-2">
                {turn.followups.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => onFollowup(q)}
                      className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm text-ink shadow-card transition-colors hover:border-accent"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {turn.trace ? (
            <p className="font-mono text-xs text-muted">
              {turn.trace.sourceCount} sources · {turn.trace.latencyMs} ms ·{' '}
              {turn.trace.inputTokens + turn.trace.outputTokens} tokens ·{' '}
              {turn.trace.synthesisModel}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
