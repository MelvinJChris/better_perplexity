import { z } from 'zod';
import { ProviderError } from '@/lib/providers/errors';
import type { LlmProvider } from '@/lib/providers/llm';
import type { Claim, Source } from '@/lib/types';

// Production extractClaims: Flash-Lite returns atomic claims as JSON, validated
// with zod and never trusted raw. The model returns only claim strings; the
// sourceUrl is attached here so attribution is correct by construction.
//
// This is a building block for the contradiction graph (#18). The live trust
// ranking does not extract per source (it corroborates over source embeddings,
// for latency and cost), so extraction cost is paid only where it is needed.

const SYSTEM_INSTRUCTION = [
  'Extract the atomic factual claims from the source text.',
  'Each claim is a single self-contained assertion (one fact, with its numbers and units).',
  'Return STRICT JSON of the form {"claims": ["claim one", "claim two"]} and nothing else.',
  'No markdown, no commentary. If there are no factual claims, return {"claims": []}.',
].join(' ');

const TEXT_BUDGET = 6000;
const MAX_CLAIMS = 30;

const extractionSchema = z.object({ claims: z.array(z.string()) });

/** Pulls a JSON object out of a model response, tolerating code fences and
 *  surrounding prose. Returns the best-effort JSON substring. */
function stripToJson(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  return first >= 0 && last > first ? t.slice(first, last + 1) : t;
}

/** Parses and validates a model response into attributed Claim[]. Throws if the
 *  output is not the expected JSON shape (the caller retries). Pure, so unit
 *  tested directly. */
export function parseClaims(raw: string, sourceUrl: string): Claim[] {
  const parsed = extractionSchema.parse(JSON.parse(stripToJson(raw)));
  return parsed.claims
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .slice(0, MAX_CLAIMS)
    .map((text) => ({ sourceUrl, text }));
}

export interface ExtractClaimsOptions {
  model?: string;
  maxAttempts?: number;
}

export async function extractClaims(
  source: Source,
  llm: LlmProvider,
  opts?: ExtractClaimsOptions,
): Promise<Claim[]> {
  const maxAttempts = opts?.maxAttempts ?? 2;
  const body = (source.text ?? source.snippet).slice(0, TEXT_BUDGET);
  const prompt = `Title: ${source.title}\nURL: ${source.url}\n\nText:\n${body}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const reminder =
      attempt === 0 ? '' : '\n\nReturn ONLY valid JSON of the form {"claims": [...]}.';
    const res = await llm.complete(prompt + reminder, {
      system: SYSTEM_INSTRUCTION,
      temperature: 0,
      model: opts?.model,
    });
    try {
      return parseClaims(res.text, source.url);
    } catch (err) {
      lastError = err;
    }
  }
  throw new ProviderError(
    `extractClaims: model did not return valid JSON after ${maxAttempts} attempts (${String(lastError)})`,
  );
}
