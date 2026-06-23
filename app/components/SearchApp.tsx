'use client';

import { useCallback, useRef, useState } from 'react';
import { streamSearch } from '@/lib/client/searchStream';
import type { ScoredSource, VerifiedAnswer } from '@/lib/types';
import type { QueryTrace } from '@/lib/trace/trace';
import { AnswerBlock } from './AnswerBlock';
import { AskHero } from './AskHero';
import { QueryForm } from './QueryForm';
import { SourceList } from './SourceList';
import { ScopeBanner, VerificationPanel } from './VerificationPanel';

type Status = 'idle' | 'streaming' | 'done' | 'error';

export function SearchApp() {
  const [status, setStatus] = useState<Status>('idle');
  const [submitted, setSubmitted] = useState('');
  const [sources, setSources] = useState<ScoredSource[]>([]);
  const [answer, setAnswer] = useState('');
  const [verified, setVerified] = useState<VerifiedAnswer | null>(null);
  const [trace, setTrace] = useState<QueryTrace | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSubmitted(q);
    setStatus('streaming');
    setSources([]);
    setAnswer('');
    setVerified(null);
    setTrace(null);
    setError('');

    try {
      for await (const event of streamSearch(q, controller.signal)) {
        switch (event.type) {
          case 'sources':
            setSources(event.sources);
            break;
          case 'token':
            setAnswer((prev) => prev + event.text);
            break;
          case 'verification':
            setVerified(event.verified);
            break;
          case 'trace':
            setTrace(event.trace);
            setStatus('done');
            break;
          case 'error':
            setError(event.message);
            setStatus('error');
            break;
        }
      }
      // Close cleanly if the stream ended without a trace or error event.
      setStatus((prev) => (prev === 'streaming' ? 'done' : prev));
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }, []);

  if (status === 'idle') {
    return <AskHero onSubmit={run} />;
  }

  const streaming = status === 'streaming';

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6">
      <header className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="shrink-0 font-mono text-xs uppercase tracking-widest text-accent"
        >
          better_perplexity
        </button>
        <div className="flex-1">
          <QueryForm onSubmit={run} variant="bar" initialValue={submitted} pending={streaming} />
        </div>
      </header>

      {status === 'error' ? (
        <div
          role="alert"
          className="mt-8 rounded-card border border-trust-low/30 bg-trust-low/5 p-4 text-sm text-ink"
        >
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1 text-muted">{error}</p>
          <button
            type="button"
            onClick={() => run(submitted)}
            className="mt-3 rounded-card border border-hairline bg-surface px-3 py-1.5 text-sm hover:border-accent"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <section aria-labelledby="sources-heading">
            <h2
              id="sources-heading"
              className="font-mono text-xs uppercase tracking-widest text-muted"
            >
              Sources{sources.length > 0 ? ` (${sources.length})` : ''}
            </h2>
            <div className="mt-3">
              {sources.length > 0 ? (
                <SourceList sources={sources} />
              ) : streaming ? (
                <p className="text-sm text-muted">Searching the web...</p>
              ) : (
                <p className="text-sm text-muted">No sources found for this query.</p>
              )}
            </div>
          </section>

          <section aria-labelledby="answer-heading">
            <h2
              id="answer-heading"
              className="font-mono text-xs uppercase tracking-widest text-muted"
            >
              Answer
            </h2>
            <div className="mt-3 space-y-3">
              {verified?.scopeMismatch ? <ScopeBanner note={verified.scopeMismatch} /> : null}
              {answer ? (
                <AnswerBlock text={answer} streaming={streaming} />
              ) : streaming ? (
                <p className="text-sm text-muted">Synthesizing a cited answer...</p>
              ) : (
                <p className="text-sm text-muted">No answer was produced.</p>
              )}
              {verified ? <VerificationPanel verified={verified} /> : null}
            </div>
          </section>

          {trace ? (
            <p className="border-t border-hairline pt-4 font-mono text-xs text-muted">
              {trace.sourceCount} sources · {trace.latencyMs} ms ·{' '}
              {trace.inputTokens + trace.outputTokens} tokens · {trace.synthesisModel}
            </p>
          ) : null}
        </div>
      )}
    </main>
  );
}
