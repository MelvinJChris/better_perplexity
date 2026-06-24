import { describe, expect, it } from 'vitest';
import { GeminiProvider } from '@/lib/providers/gemini';
import type { CompleteChunk } from '@/lib/providers/llm';
import { RateLimitQueue } from '@/lib/providers/rateLimitQueue';

const fastQueue = (): RateLimitQueue =>
  new RateLimitQueue({
    maxConcurrent: 1,
    minIntervalMs: 0,
    maxRetries: 0,
    baseDelayMs: 1,
    maxDelayMs: 1,
    sleep: () => Promise.resolve(),
    random: () => 0,
  });

const sseResponse = (lines: string[]): Response =>
  new Response(lines.join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

const drain = async (chunks: AsyncIterable<CompleteChunk>): Promise<CompleteChunk[]> => {
  const out: CompleteChunk[] = [];
  for await (const chunk of chunks) out.push(chunk);
  return out;
};

describe('GeminiProvider.completeStream', () => {
  it('parses SSE chunks into text deltas and final usage', async () => {
    const fetchFn: typeof fetch = async () =>
      sseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Hello "}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"world"}]}}],"usageMetadata":{"promptTokenCount":11,"candidatesTokenCount":3}}\n\n',
      ]);
    const provider = new GeminiProvider({ apiKey: 'k', fetchFn, queue: fastQueue() });

    const chunks = await drain(provider.completeStream('hi', { model: provider.synthesisModel }));
    expect(chunks.map((c) => c.text).join('')).toBe('Hello world');
    const last = chunks.at(-1);
    expect(last?.inputTokens).toBe(11);
    expect(last?.outputTokens).toBe(3);
  });

  it('targets the streamGenerateContent SSE endpoint', async () => {
    let url = '';
    const fetchFn: typeof fetch = async (u) => {
      url = String(u);
      return sseResponse(['data: {"candidates":[{"content":{"parts":[{"text":"x"}]}}]}\n\n']);
    };
    const provider = new GeminiProvider({ apiKey: 'k', fetchFn, queue: fastQueue() });

    await drain(provider.completeStream('hi'));
    expect(url).toContain(':streamGenerateContent');
    expect(url).toContain('alt=sse');
  });
});
