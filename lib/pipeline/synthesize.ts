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

/** Prior turn carried into a follow-up so the answer is thread-aware without
 *  re-fetching the earlier sources (#28). */
export interface ThreadContext {
  question: string;
  answer: string;
}

const SYSTEM_INSTRUCTION = [
  'You are a research assistant. Answer the question using ONLY the numbered sources provided.',
  'Lead with a one-sentence direct answer (the bottom line), then concise supporting detail.',
  'Be concise: short paragraphs, no padding, and prefer prose over long bulleted lists.',
  'Cite every claim with its source number in square brackets, like [1] or [2][3].',
  'Prefer higher-trust sources. If the sources disagree, say so and attribute each side.',
  'If the sources do not support an answer, say so plainly. Never invent facts or sources.',
].join(' ');

/** Builds the synthesis prompt from trust-ranked sources (pure, so it is unit
 *  tested). Sources are numbered in the order given; rank them before calling.
 *  An optional prior turn is included as lightweight thread context. */
export function buildSynthesisPrompt(
  query: string,
  sources: ScoredSource[],
  context?: ThreadContext,
): SynthesisPrompt {
  const list = sources
    .map((s, i) => {
      const body = s.snippet || s.text || '';
      return `[${i + 1}] ${s.title} (${hostOf(s.url)}, trust ${s.trustScore})\n${body}`;
    })
    .join('\n\n');

  const preamble = context
    ? `Earlier in this research thread:\nQ: ${context.question}\nA: ${context.answer.slice(0, 1000)}\n\nUse it only for context; answer the new question from the sources below.\n\n`
    : '';

  return {
    system: SYSTEM_INSTRUCTION,
    user: `${preamble}Question: ${query}\n\nSources:\n${list}`,
  };
}

/** Streams the synthesized answer so the client can render partial results. */
export function synthesizeStream(
  query: string,
  sources: ScoredSource[],
  llm: LlmProvider,
  model?: string,
  context?: ThreadContext,
): AsyncIterable<CompleteChunk> {
  const { system, user } = buildSynthesisPrompt(query, sources, context);
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
