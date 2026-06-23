import { z } from 'zod';
import {
  buildContradictionGraph,
  summarizeContradictions,
  type GraphClaim,
} from '@/lib/pipeline/contradictionGraph';
import { countCorroboratingDomains } from '@/lib/pipeline/corroboration';
import { detectEvidenceLevel, type EvidenceLevel } from '@/lib/pipeline/evidence';
import { suggestFollowups } from '@/lib/pipeline/followups';
import { extractMetric } from '@/lib/metrics';
import { scoreTrust, type TrustSignals } from '@/lib/pipeline/scoreTrust';
import { synthesizeStream, type ThreadContext } from '@/lib/pipeline/synthesize';
import { verify } from '@/lib/pipeline/verify';
import type { LlmProvider } from '@/lib/providers/llm';
import type { SearchProvider } from '@/lib/providers/search';
import { logTrace, type QueryTrace } from '@/lib/trace/trace';
import type { ScoredSource, Source, VerifiedAnswer } from '@/lib/types';

/** Builds the trust signals for a result set: corroboration across independent
 *  domains (one batched embed) and recency from publish dates. Returns the
 *  embeddings so the contradiction graph can reuse them at no extra cost.
 *  Embedding failure degrades to no corroboration rather than failing the query. */
async function buildTrustSignals(
  sources: Source[],
  llm: LlmProvider,
  now: () => number,
): Promise<{ signals: TrustSignals; embeddings: number[][] }> {
  const ageDays: Record<string, number> = {};
  const evidenceLevels: Record<string, EvidenceLevel> = {};
  for (const source of sources) {
    if (source.publishedAt) {
      const published = Date.parse(source.publishedAt);
      if (!Number.isNaN(published)) ageDays[source.url] = (now() - published) / 86_400_000;
    }
    const level = detectEvidenceLevel(`${source.title} ${source.snippet} ${source.text ?? ''}`);
    if (level) evidenceLevels[source.url] = level;
  }

  const corroboratingDomains: Record<string, number> = {};
  let embeddings: number[][] = [];
  try {
    embeddings = await llm.embed(sources.map((s) => `${s.title}\n${s.snippet}`));
    const counts = countCorroboratingDomains(sources, embeddings);
    sources.forEach((s, i) => {
      corroboratingDomains[s.url] = counts[i];
    });
  } catch (err) {
    console.warn('runSearch: corroboration embedding skipped', err);
  }

  return { signals: { corroboratingDomains, ageDays, evidenceLevels }, embeddings };
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
  | { type: 'contradictions'; disputed: GraphClaim[][] }
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
    const { signals, embeddings } = await buildTrustSignals(sources, deps.llm, now);
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

    // Verify the answer and suggest follow-ups concurrently: they both depend
    // only on the finished answer and are independent of each other, so awaiting
    // them in series just added a round-trip (and a free-tier spacing gap). Each
    // degrades to no event on failure without affecting the other or the query.
    if (answer.trim()) {
      const [verified, followups] = await Promise.allSettled([
        verify(answer, scored, deps.llm, { model: deps.synthesisModel }),
        suggestFollowups(query, answer, scored, deps.llm),
      ]);

      if (verified.status === 'fulfilled') yield { type: 'verification', verified: verified.value };
      else console.warn('runSearch: verification skipped', verified.reason);

      if (followups.status === 'fulfilled' && followups.value.length > 0) {
        yield { type: 'followups', followups: followups.value };
      } else if (followups.status === 'rejected') {
        console.warn('runSearch: follow-ups skipped', followups.reason);
      }
    }

    // (Stretch) Contradiction graph over the sources, reusing the corroboration
    // embeddings so it costs nothing extra. Emits only when a dispute is found.
    const graphClaims: GraphClaim[] = sources.map((s, i) => {
      const metric = extractMetric(`${s.title} ${s.snippet}`);
      return {
        id: String(i),
        sourceUrl: s.url,
        text: s.snippet,
        value: metric?.value ?? null,
        unit: metric?.unit,
      };
    });
    const disputed = summarizeContradictions(buildContradictionGraph(graphClaims, embeddings));
    if (disputed.length > 0) yield { type: 'contradictions', disputed };

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
