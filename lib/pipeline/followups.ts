import { z } from 'zod';
import { hostOf } from '@/lib/pipeline/domainPrior';
import { extractJsonObject } from '@/lib/pipeline/json';
import { ProviderError } from '@/lib/providers/errors';
import type { LlmProvider } from '@/lib/providers/llm';
import type { ScoredSource } from '@/lib/types';

// Suggested follow-up questions that extend a research thread (#28). Flash-Lite
// returns schema-validated JSON; parseFollowups is pure and unit-tested. Failure
// degrades to no suggestions rather than failing the query.

const MAX_FOLLOWUPS = 4;
const followupsSchema = z.object({ followups: z.array(z.string()) });

export function parseFollowups(raw: string): string[] {
  const parsed = followupsSchema.parse(JSON.parse(extractJsonObject(raw)));
  return parsed.followups
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .slice(0, MAX_FOLLOWUPS);
}

export interface FollowupsOptions {
  model?: string;
  maxAttempts?: number;
}

export async function suggestFollowups(
  query: string,
  answer: string,
  sources: ScoredSource[],
  llm: LlmProvider,
  opts?: FollowupsOptions,
): Promise<string[]> {
  const maxAttempts = opts?.maxAttempts ?? 2;
  const system =
    'Suggest 3 to 4 concise follow-up research questions that naturally extend the answer. ' +
    'Each should be self-contained and worth researching next. ' +
    'Return STRICT JSON {"followups":["...","..."]} and nothing else.';
  const domains = sources
    .slice(0, 6)
    .map((s) => hostOf(s.url))
    .join(', ');
  const prompt = `Question: ${query}\n\nAnswer:\n${answer.slice(0, 2000)}\n\nSources: ${domains}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const reminder = attempt === 0 ? '' : '\n\nReturn ONLY the JSON described above.';
    const res = await llm.complete(prompt + reminder, {
      system,
      temperature: 0.4,
      model: opts?.model,
    });
    try {
      return parseFollowups(res.text);
    } catch (err) {
      lastError = err;
    }
  }
  throw new ProviderError(
    `suggestFollowups: model did not return valid JSON after ${maxAttempts} attempts (${String(lastError)})`,
  );
}
