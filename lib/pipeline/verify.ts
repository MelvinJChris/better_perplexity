import { z } from 'zod';
import { hostOf } from '@/lib/pipeline/domainPrior';
import { extractJsonObject } from '@/lib/pipeline/json';
import { ProviderError } from '@/lib/providers/errors';
import type { LlmProvider } from '@/lib/providers/llm';
import type { Citation, ScoredSource, VerifiedAnswer } from '@/lib/types';

// Per-sentence verification: each answer sentence is checked for support from a
// high-trust source, and the model also flags scope mismatches (e.g. a US figure
// answering a global question). Unsupported sentences are flagged, never silently
// dropped. Sentence splitting and citation extraction are pure (unit-tested);
// the support judgement is an injected LLM call (validated, behaviour in #17).

const HIGH_TRUST = 75;

const verdictSchema = z.object({
  verdicts: z.array(z.object({ index: z.number().int(), supported: z.boolean() })),
  scopeNote: z.string().optional(),
});

/** Splits prose into sentences. Robust enough for answer text; trims empties. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Maps the [n] markers in the answer to their cited sources. */
export function extractCitations(answer: string, sources: ScoredSource[]): Citation[] {
  const markers = new Set<number>();
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= sources.length) markers.add(n);
  }
  return [...markers]
    .sort((a, b) => a - b)
    .map((n) => ({ marker: n, sourceUrl: sources[n - 1].url }));
}

export interface VerifyOptions {
  model?: string;
  maxAttempts?: number;
}

async function judgeSentences(
  sentences: string[],
  sources: ScoredSource[],
  llm: LlmProvider,
  opts?: VerifyOptions,
): Promise<{ supported: Set<number>; scopeNote?: string }> {
  const maxAttempts = opts?.maxAttempts ?? 2;
  const system =
    'You verify whether each numbered answer sentence is supported by the provided sources. ' +
    'A sentence is supported only if a source substantively backs its claim. ' +
    'Also detect scope mismatches (for example a US figure used to answer a global question). ' +
    'Return STRICT JSON: {"verdicts":[{"index":0,"supported":true}],"scopeNote":"optional"}.';
  const sourceList = sources
    .map((s, i) => `[${i + 1}] (${hostOf(s.url)}, trust ${s.trustScore}) ${s.title}: ${s.snippet}`)
    .join('\n');
  const sentenceList = sentences.map((s, i) => `${i}. ${s}`).join('\n');
  const prompt = `Sources:\n${sourceList}\n\nSentences:\n${sentenceList}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const reminder = attempt === 0 ? '' : '\n\nReturn ONLY the JSON described above.';
    const res = await llm.complete(prompt + reminder, {
      system,
      temperature: 0,
      model: opts?.model,
    });
    try {
      const parsed = verdictSchema.parse(JSON.parse(extractJsonObject(res.text)));
      const supported = new Set<number>();
      for (const v of parsed.verdicts) if (v.supported) supported.add(v.index);
      return { supported, scopeNote: parsed.scopeNote?.trim() || undefined };
    } catch (err) {
      lastError = err;
    }
  }
  throw new ProviderError(
    `verify: model did not return valid JSON after ${maxAttempts} attempts (${String(lastError)})`,
  );
}

export async function verify(
  answer: string,
  sources: ScoredSource[],
  llm: LlmProvider,
  opts?: VerifyOptions,
): Promise<VerifiedAnswer> {
  const sentences = splitSentences(answer);
  const citations = extractCitations(answer, sources);
  if (sentences.length === 0) {
    return { text: answer, citations, unsupported: [] };
  }

  // Prefer high-trust sources for the support bar; fall back to all if none.
  const highTrust = sources.filter((s) => s.trustScore >= HIGH_TRUST);
  const judgeAgainst = highTrust.length > 0 ? highTrust : sources;

  const { supported, scopeNote } = await judgeSentences(sentences, judgeAgainst, llm, opts);
  // A sentence with no explicit "supported" verdict is treated as unsupported.
  const unsupported = sentences.filter((_, i) => !supported.has(i));

  return { text: answer, citations, unsupported, scopeMismatch: scopeNote };
}
