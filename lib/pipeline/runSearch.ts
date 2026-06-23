import { z } from 'zod';
import { countCorroboratingDomains } from '@/lib/pipeline/corroboration';
import { suggestFollowups } from '@/lib/pipeline/followups';
import { scoreTrust, type TrustSignals } from '@/lib/pipeline/scoreTrust';
import { synthesizeStream, type ThreadContext } from '@/lib/pipeline/synthesize';
import { verify } from '@/lib/pipeline/verify';
import type { LlmProvider } from '@/lib/providers/llm';
import type { SearchProvider } from '@/lib/providers/search';
import { logTrace, type QueryTrace } from '@/lib/trace/trace';
import type { ScoredSource, Source, VerifiedAnswer } from '@/lib/types';

/** Builds the trust signals for a result set: corroboration across independent
 *  domains (one batched embed) and recency from publish dates. Embedding failure
 *  degrades to no corroboration rather than failing the query. */
async function buildTrustSignals(
  sources: Source[],
  llm: LlmProvider,
  now: () => number,
): Promise<TrustSignals> {
  const ageDays: Record<string, number> = {};
  for (const source of sources) {
    if (!source.publishedAt) continue;
    const published = Date.parse(source.publishedAt);
    if (!Number.isNaN(published)) ageDays[source.url] = (now() - published) / 86_400_000;
  }

  const corroboratingDomains: Record<string, number> = {};
  try {
    const embeddings = await llm.embed(sources.map((s) => `${s.title}\n${s.snippet}`));
    const counts = countCorroboratingDomains(sources, embeddings);
    sources.forEach((s, i) => {
      corroboratingDomains[s.url] = counts[i];
    });
  } catch (err) {
    console.warn('runSearch: corroboration embedding skipped', err);
  }

  return { corroboratingDomains, ageDays };
}

// The pipeline core, factored out of the route handler so it can be driven with
// injected providers in tests (no network, no keys). The route just wires the
// env-backed providers to it and serializes the events (see #9).

export const searchRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  context: z.object({ question: z.string(), answer: z.string() }).optional(),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;

/** Events streamed to the client, one JSON object per line (NDJSON). */
export type SearchEvent =
  | { type: 'sources'; sources: ScoredSource[] }
  | { type: 'token'; text: string }
  | { type: 'verification'; verified: VerifiedAnswer }
  | { type: 'followups'; followups: string[] }
  | { type: 'trace'; trace: QueryTrace }
  | { type: 'error'; message: string };

export interface RunSearchDeps {
  search: SearchProvider;
  llm: LlmProvider;
  synthesisModel?: string;
  context?: ThreadContext;
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
    const signals = await buildTrustSignals(sources, deps.llm, now);
    const scored = scoreTrust(sources, signals);
    sourceCount = scored.length;
    yield { type: 'sources', sources: scored };

    let answer = '';
    for await (const chunk of synthesizeStream(
      query,
      scored,
      deps.llm,
      deps.synthesisModel,
      deps.context,
    )) {
      if (chunk.text) {
        answer += chunk.text;
        yield { type: 'token', text: chunk.text };
      }
      if (chunk.inputTokens !== undefined) inputTokens = chunk.inputTokens;
      if (chunk.outputTokens !== undefined) outputTokens = chunk.outputTokens;
    }

    // Verify the finished answer against high-trust sources. A verification
    // failure must not fail the whole query, so it degrades to no event.
    if (answer.trim()) {
      try {
        const verified = await verify(answer, scored, deps.llm, { model: deps.synthesisModel });
        yield { type: 'verification', verified };
      } catch (err) {
        console.warn('runSearch: verification skipped', err);
      }

      // Suggest follow-ups (additive; failure degrades to no suggestions).
      try {
        const followups = await suggestFollowups(query, answer, scored, deps.llm);
        if (followups.length > 0) yield { type: 'followups', followups };
      } catch (err) {
        console.warn('runSearch: follow-ups skipped', err);
      }
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
