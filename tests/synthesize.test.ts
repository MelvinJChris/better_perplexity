import { describe, expect, it } from 'vitest';
import { buildSynthesisPrompt, synthesize } from '@/lib/pipeline/synthesize';
import type { CompleteChunk, LlmProvider } from '@/lib/providers/llm';
import type { ScoredSource } from '@/lib/types';

const scored = (url: string, title: string, snippet: string, trustScore: number): ScoredSource => ({
  url,
  title,
  snippet,
  rawRelevance: 1,
  trustScore,
  trustReason: 'r',
});

const streamingLlm = (chunks: CompleteChunk[]): LlmProvider => ({
  complete: async () => {
    throw new Error('unused');
  },
  async *completeStream() {
    for (const chunk of chunks) yield chunk;
  },
  embed: async (texts) => texts.map(() => [1, 0]),
});

describe('buildSynthesisPrompt', () => {
  const prompt = buildSynthesisPrompt('What is X?', [
    scored('https://iea.org/a', 'IEA report', 'X is 945 TWh', 95),
    scored('https://blog.example/b', 'Blog', 'X is huge', 30),
  ]);

  it('includes the question and numbers each source with its host', () => {
    expect(prompt.user).toContain('Question: What is X?');
    expect(prompt.user).toContain('[1] IEA report');
    expect(prompt.user).toContain('iea.org');
    expect(prompt.user).toContain('[2] Blog');
  });

  it('instructs the model to cite every claim and not invent sources', () => {
    expect(prompt.system.toLowerCase()).toContain('cite every claim');
    expect(prompt.system.toLowerCase()).toContain('never invent');
  });
});

describe('synthesize', () => {
  it('collects the streamed answer into a single string', async () => {
    const llm = streamingLlm([{ text: 'Hello ' }, { text: 'world [1]', outputTokens: 5 }]);
    const out = await synthesize('q', [scored('https://iea.org/a', 't', 's', 90)], llm);
    expect(out).toBe('Hello world [1]');
  });
});
