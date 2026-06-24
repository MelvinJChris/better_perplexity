import { describe, expect, it } from 'vitest';
import { extractClaims, parseClaims } from '@/lib/pipeline/extractClaims';
import type { CompleteResult, LlmProvider } from '@/lib/providers/llm';
import type { Source } from '@/lib/types';

const source: Source = {
  url: 'https://iea.org/report',
  title: 'Electricity 2024',
  snippet: 'Global data center demand is about 945 TWh by 2030.',
  rawRelevance: 1,
};

const result = (text: string): CompleteResult => ({
  text,
  inputTokens: 0,
  outputTokens: 0,
  latencyMs: 0,
  model: 'flash-lite',
});

/** LLM whose complete() returns each scripted response in turn. */
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

describe('parseClaims', () => {
  it('parses a JSON object of claims and attributes each to the source', () => {
    const claims = parseClaims('{"claims":["A is 945 TWh","B grows fast"]}', source.url);
    expect(claims).toEqual([
      { sourceUrl: source.url, text: 'A is 945 TWh' },
      { sourceUrl: source.url, text: 'B grows fast' },
    ]);
  });

  it('tolerates code fences and surrounding prose', () => {
    const fenced = 'Here you go:\n```json\n{"claims": ["only claim"]}\n```';
    expect(parseClaims(fenced, source.url)).toEqual([
      { sourceUrl: source.url, text: 'only claim' },
    ]);
  });

  it('drops empty claim strings', () => {
    expect(parseClaims('{"claims":["keep","  "]}', source.url)).toEqual([
      { sourceUrl: source.url, text: 'keep' },
    ]);
  });

  it('throws on malformed output', () => {
    expect(() => parseClaims('not json at all', source.url)).toThrow();
    expect(() => parseClaims('{"claims": "not an array"}', source.url)).toThrow();
  });
});

describe('extractClaims', () => {
  it('returns validated claims on the first valid response', async () => {
    const llm = scriptedLlm(['{"claims":["x"]}']);
    const claims = await extractClaims(source, llm);
    expect(claims).toEqual([{ sourceUrl: source.url, text: 'x' }]);
    expect(llm.calls).toBe(1);
  });

  it('retries once on malformed output, then succeeds', async () => {
    const llm = scriptedLlm(['garbage', '{"claims":["recovered"]}']);
    const claims = await extractClaims(source, llm, { maxAttempts: 2 });
    expect(claims).toEqual([{ sourceUrl: source.url, text: 'recovered' }]);
    expect(llm.calls).toBe(2);
  });

  it('throws after exhausting the bounded retries', async () => {
    const llm = scriptedLlm(['nope']);
    await expect(extractClaims(source, llm, { maxAttempts: 2 })).rejects.toThrow('valid JSON');
    expect(llm.calls).toBe(2);
  });
});
