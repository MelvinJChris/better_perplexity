import { hostOf } from '@/lib/pipeline/domainPrior';
import type { CompleteChunk, LlmProvider } from '@/lib/providers/llm';
import type { ScoredSource } from '@/lib/types';

// Flash composes the answer from trust-weighted sources. The prompt numbers the
// sources and requires every claim to carry a [n] citation, so the answer stays
// auditable. Trust-aware ranking refinement and recency land in #13.

export interface SynthesisPrompt {
  system: string;
  user: string;
}

const SYSTEM_INSTRUCTION = [
  'You are a research assistant. Answer the question using ONLY the numbered sources provided.',
  'Cite every claim with its source number in square brackets, like [1] or [2][3].',
  'Prefer higher-trust sources. If the sources disagree, say so and attribute each side.',
  'If the sources do not support an answer, say so plainly. Never invent facts or sources.',
].join(' ');

/** Builds the synthesis prompt from trust-ranked sources (pure, so it is unit
 *  tested). Sources are numbered in the order given; rank them before calling. */
export function buildSynthesisPrompt(query: string, sources: ScoredSource[]): SynthesisPrompt {
  const list = sources
    .map((s, i) => {
      const body = s.snippet || s.text || '';
      return `[${i + 1}] ${s.title} (${hostOf(s.url)}, trust ${s.trustScore})\n${body}`;
    })
    .join('\n\n');

  return {
    system: SYSTEM_INSTRUCTION,
    user: `Question: ${query}\n\nSources:\n${list}`,
  };
}

/** Streams the synthesized answer so the client can render partial results. */
export function synthesizeStream(
  query: string,
  sources: ScoredSource[],
  llm: LlmProvider,
  model?: string,
): AsyncIterable<CompleteChunk> {
  const { system, user } = buildSynthesisPrompt(query, sources);
  return llm.completeStream(user, { system, model, temperature: 0.2 });
}

/** Non-streaming convenience: collects the streamed answer into one string. */
export async function synthesize(
  query: string,
  sources: ScoredSource[],
  llm: LlmProvider,
  model?: string,
): Promise<string> {
  let text = '';
  for await (const chunk of synthesizeStream(query, sources, llm, model)) {
    text += chunk.text;
  }
  return text;
}
