import { z } from 'zod';
import { scoreTrust } from '@/lib/pipeline/scoreTrust';
import { synthesizeStream } from '@/lib/pipeline/synthesize';
import type { LlmProvider } from '@/lib/providers/llm';
import type { SearchProvider } from '@/lib/providers/search';
import { logTrace, type QueryTrace } from '@/lib/trace/trace';
import type { ScoredSource } from '@/lib/types';

// The pipeline core, factored out of the route handler so it can be driven with
// injected providers in tests (no network, no keys). The route just wires the
// env-backed providers to it and serializes the events (see #9).

export const searchRequestSchema = z.object({
  query: z.string().min(1).max(2000),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;

/** Events streamed to the client, one JSON object per line (NDJSON). */
export type SearchEvent =
  | { type: 'sources'; sources: ScoredSource[] }
  | { type: 'token'; text: string }
  | { type: 'trace'; trace: QueryTrace }
  | { type: 'error'; message: string };

export interface RunSearchDeps {
  search: SearchProvider;
  llm: LlmProvider;
  synthesisModel?: string;
  now?: () => number;
}

/** Retrieve, trust-rank, then stream a cited synthesized answer, ending with a
 *  trace. Errors become a terminal `error` event rather than throwing, so the
 *  stream always closes cleanly. Stateless and safe to retry. */
export async function* runSearchEvents(
  query: string,
  deps: RunSearchDeps,
): AsyncIterable<SearchEvent> {
  const now = deps.now ?? (() => Date.now());
  const startedAt = now();
  let inputTokens = 0;
  let outputTokens = 0;
  let sourceCount = 0;

  try {
    const sources = await deps.search.search(query);
    const scored = scoreTrust(sources);
    sourceCount = scored.length;
    yield { type: 'sources', sources: scored };

    for await (const chunk of synthesizeStream(query, scored, deps.llm, deps.synthesisModel)) {
      if (chunk.text) yield { type: 'token', text: chunk.text };
      if (chunk.inputTokens !== undefined) inputTokens = chunk.inputTokens;
      if (chunk.outputTokens !== undefined) outputTokens = chunk.outputTokens;
    }

    const trace: QueryTrace = {
      query,
      sourceCount,
      synthesisModel: deps.synthesisModel ?? 'default',
      inputTokens,
      outputTokens,
      latencyMs: now() - startedAt,
    };
    logTrace(trace);
    yield { type: 'trace', trace };
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : 'Search failed' };
  }
}

/** Serializes a SearchEvent stream as NDJSON for the HTTP response body. */
export function ndjsonStream(events: AsyncIterable<SearchEvent>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream failed';
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'error', message })}\n`));
      } finally {
        controller.close();
      }
    },
  });
}
