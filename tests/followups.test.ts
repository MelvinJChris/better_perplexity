import { describe, expect, it } from 'vitest';
import { parseFollowups, suggestFollowups } from '@/lib/pipeline/followups';
import type { CompleteResult, LlmProvider } from '@/lib/providers/llm';
import type { ScoredSource } from '@/lib/types';

const result = (text: string): CompleteResult => ({
  text,
  inputTokens: 0,
  outputTokens: 0,
  latencyMs: 0,
  model: 'flash-lite',
});

const scriptedLlm = (responses: string[]): LlmProvider & { calls: number } => {
  const provider = {
    calls: 0,
    async complete() {
      const text = responses[Math.min(provider.calls, responses.length - 1)];
      provider.calls += 1;
      return result(text);
    },
    async *completeStream() {},
    async embed(texts: string[]) {
      return texts.map(() => [0]);
    },
  };
  return provider;
};

const sources: ScoredSource[] = [
  {
    url: 'https://iea.org/a',
    title: 't',
    snippet: 's',
    rawRelevance: 1,
    trustScore: 95,
    trustReason: 'r',
    corroborations: 2,
  },
];

describe('parseFollowups', () => {
  it('parses and caps at four suggestions', () => {
    const raw = '{"followups":["a","b","c","d","e"]}';
    expect(parseFollowups(raw)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('tolerates code fences and drops empties', () => {
    expect(parseFollowups('```json\n{"followups":["keep","  "]}\n```')).toEqual(['keep']);
  });

  it('throws on malformed output', () => {
    expect(() => parseFollowups('nope')).toThrow();
  });
});

describe('suggestFollowups', () => {
  it('retries malformed output then returns suggestions', async () => {
    const llm = scriptedLlm(['garbage', '{"followups":["What about Asia?","And cost?"]}']);
    const out = await suggestFollowups('q', 'an answer', sources, llm, { maxAttempts: 2 });
    expect(out).toEqual(['What about Asia?', 'And cost?']);
    expect(llm.calls).toBe(2);
  });
});
