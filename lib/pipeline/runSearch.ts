import { z } from 'zod';
import {
  buildContradictionGraph,
  summarizeContradictions,
  type GraphClaim,
} from '@/lib/pipeline/contradictionGraph';
import { countCorroboratingDomains } from '@/lib/pipeline/corroboration';
import { hostOf } from '@/lib/pipeline/domainPrior';
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

/** A source as a node in the knowledge graph, labeled by its [n] on the cards. */
export interface GraphNode {
  id: string;
  index: number;
  domain: string;
  trustScore: number;
}

export interface ContradictionGraphData {
  nodes: GraphNode[];
  edges: { a: string; b: string; relation: 'agree' | 'disagree' }[];
}

/** Events streamed to the client, one JSON object per line (NDJSON). */
export type SearchEvent =
  | { type: 'sources'; sources: ScoredSource[] }
  | { type: 'token'; text: string }
  | { type: 'verification'; verified: VerifiedAnswer }
  | { type: 'contradictions'; disputed: GraphClaim[][]; graph: ContradictionGraphData }
  | { type: 'followups'; followups: string[] }
  | { type: 'answer_error'; message: string }
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
 *  trace. Retrieval/scoring failure is terminal (nothing to show without
 *  sources); a synthesis failure is non-fatal, so the sources, trust layer, and
 *  knowledge graph still render with an answer_error notice. Stateless and safe
 *  to retry. */
export async function* runSearchEvents(
  query: string,
  deps: RunSearchDeps,
): AsyncIterable<SearchEvent> {
  const now = deps.now ?? (() => Date.now());
  const startedAt = now();
  let inputTokens = 0;
  let outputTokens = 0;

  // Retrieval + scoring: terminal on failure (there is nothing to show).
  let sources: Source[];
  let embeddings: number[][];
  let scored: ScoredSource[];
  try {
    sources = await deps.search.search(query);
    const built = await buildTrustSignals(sources, deps.llm, now);
    embeddings = built.embeddings;
    scored = scoreTrust(sources, built.signals);
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : 'Search failed' };
    return;
  }
  yield { type: 'sources', sources: scored };

  // Knowledge graph depends only on the sources and their embeddings, so emit it
  // before synthesis and independent of whether the answer succeeds. Built in
  // scored (display) order so node ids line up with the source-card [n].
  const embByUrl = new Map(sources.map((s, i) => [s.url, embeddings[i] ?? []]));
  const graphClaims: GraphClaim[] = scored.map((s, i) => {
    const metric = extractMetric(`${s.title} ${s.snippet}`);
    return {
      id: String(i),
      sourceUrl: s.url,
      text: s.snippet,
      value: metric?.value ?? null,
      unit: metric?.unit,
    };
  });
  const graph = buildContradictionGraph(
    graphClaims,
    scored.map((s) => embByUrl.get(s.url) ?? []),
  );
  if (graph.edges.length > 0) {
    const nodes: GraphNode[] = scored.map((s, i) => ({
      id: String(i),
      index: i + 1,
      domain: hostOf(s.url),
      trustScore: s.trustScore,
    }));
    yield {
      type: 'contradictions',
      disputed: summarizeContradictions(graph),
      graph: { nodes, edges: graph.edges },
    };
  }

  // Synthesis is non-fatal: a failure (e.g. rate limit) must not discard the
  // sources and graph already produced, so it degrades to an answer_error notice.
  let answer = '';
  try {
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
  } catch (err) {
    console.warn('runSearch: synthesis failed', err);
  }

  if (answer.trim()) {
    // Verify and suggest follow-ups concurrently: both depend only on the
    // finished answer and are independent, so each degrades on its own.
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
  } else {
    yield {
      type: 'answer_error',
      message: 'The answer could not be generated (the model may be rate-limited). Try again.',
    };
  }

  const trace: QueryTrace = {
    query,
    sourceCount: scored.length,
    synthesisModel: deps.synthesisModel ?? 'default',
    inputTokens,
    outputTokens,
    latencyMs: now() - startedAt,
  };
  logTrace(trace);
  yield { type: 'trace', trace };
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
