'use client';

import { useCallback, useRef, useState } from 'react';
import { streamSearch } from '@/lib/client/searchStream';
import { AskHero } from './AskHero';
import { QueryForm } from './QueryForm';
import { ResultTurn, type Turn } from './ResultTurn';

export function SearchApp() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);

  const patchTurn = useCallback((id: number, patch: Partial<Turn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const run = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      if (!query) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // The most recent completed turn becomes lightweight context, so a
      // follow-up is thread-aware without re-fetching the earlier sources.
      const prior = [...turns].reverse().find((t) => t.status === 'done' && t.answer);
      const context = prior ? { question: prior.query, answer: prior.answer } : undefined;

      const id = nextId.current++;
      const turn: Turn = {
        id,
        query,
        status: 'streaming',
        sources: [],
        answer: '',
        verified: null,
        followups: [],
        trace: null,
        error: '',
      };
      setTurns((prev) => [...prev, turn]);

      try {
        for await (const event of streamSearch(query, controller.signal, context)) {
          switch (event.type) {
            case 'sources':
              patchTurn(id, { sources: event.sources });
              break;
            case 'token':
              setTurns((prev) =>
                prev.map((t) => (t.id === id ? { ...t, answer: t.answer + event.text } : t)),
              );
              break;
            case 'verification':
              patchTurn(id, { verified: event.verified });
              break;
            case 'followups':
              patchTurn(id, { followups: event.followups });
              break;
            case 'trace':
              patchTurn(id, { trace: event.trace, status: 'done' });
              break;
            case 'error':
              patchTurn(id, { error: event.message, status: 'error' });
              break;
          }
        }
        patchTurn(id, { status: 'done' });
        setTurns((prev) =>
          prev.map((t) => (t.id === id && t.status === 'streaming' ? { ...t, status: 'done' } : t)),
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        patchTurn(id, {
          error: err instanceof Error ? err.message : 'Something went wrong',
          status: 'error',
        });
      }
    },
    [patchTurn, turns],
  );

  if (turns.length === 0) {
    return <AskHero onSubmit={run} />;
  }

  const busy = turns.some((t) => t.status === 'streaming');

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6">
      <header className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setTurns([])}
          className="shrink-0 font-mono text-xs uppercase tracking-widest text-accent"
        >
          better_perplexity
        </button>
        <div className="flex-1">
          <QueryForm onSubmit={run} variant="bar" pending={busy} />
        </div>
      </header>

      <div className="mt-8 space-y-8">
        {turns.map((turn) => (
          <ResultTurn key={turn.id} turn={turn} onFollowup={run} onRetry={run} />
        ))}
      </div>
    </main>
  );
}
