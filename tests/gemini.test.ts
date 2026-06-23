import { describe, expect, it } from 'vitest';
import { ProviderError } from '@/lib/providers/errors';
import { GeminiProvider } from '@/lib/providers/gemini';
import { RateLimitQueue } from '@/lib/providers/rateLimitQueue';

// A queue with no spacing and instant backoff so provider tests stay fast and
// deterministic while still exercising the real retry path.
const fastQueue = (maxRetries = 0): RateLimitQueue =>
  new RateLimitQueue({
    maxConcurrent: 1,
    minIntervalMs: 0,
    maxRetries,
    baseDelayMs: 1,
    maxDelayMs: 1,
    sleep: () => Promise.resolve(),
    random: () => 0,
  });

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

interface Call {
  url: string;
  init?: RequestInit;
}

describe('GeminiProvider.complete', () => {
  it('parses text, token counts, latency, and model', async () => {
    const calls: Call[] = [];
    const fetchFn: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: 'Hello ' }, { text: 'world' }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 },
      });
    };
    const provider = new GeminiProvider({ apiKey: 'k', fetchFn, queue: fastQueue() });

    const result = await provider.complete('hi', { temperature: 0.2 });

    expect(result.text).toBe('Hello world');
    expect(result.inputTokens).toBe(12);
    expect(result.outputTokens).toBe(5);
    expect(result.model).toBe(provider.completeModel);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    expect(calls[0].url).toContain(`${provider.completeModel}:generateContent`);
    const sent = JSON.parse(String(calls[0].init?.body));
    expect(sent.contents[0].parts[0].text).toBe('hi');
    expect(sent.generationConfig.temperature).toBe(0.2);
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('k');
  });

  it('routes to the model named in opts (synthesis path)', async () => {
    const calls: string[] = [];
    const fetchFn: typeof fetch = async (url) => {
      calls.push(String(url));
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: 'x' }] } }],
        usageMetadata: {},
      });
    };
    const provider = new GeminiProvider({ apiKey: 'k', fetchFn, queue: fastQueue() });

    await provider.complete('hi', { model: provider.synthesisModel });
    expect(calls[0]).toContain(`${provider.synthesisModel}:generateContent`);
  });

  it('throws ProviderError carrying the status on a non-ok response', async () => {
    const fetchFn: typeof fetch = async () => new Response('bad', { status: 400 });
    const provider = new GeminiProvider({ apiKey: 'k', fetchFn, queue: fastQueue() });
    await expect(provider.complete('hi')).rejects.toBeInstanceOf(ProviderError);
  });

  it('retries a 429 through the queue and then succeeds', async () => {
    let attempt = 0;
    const fetchFn: typeof fetch = async () => {
      attempt += 1;
      if (attempt === 1) return new Response('slow down', { status: 429 });
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        usageMetadata: {},
      });
    };
    const provider = new GeminiProvider({ apiKey: 'k', fetchFn, queue: fastQueue(2) });

    const result = await provider.complete('hi');
    expect(result.text).toBe('ok');
    expect(attempt).toBe(2);
  });
});

describe('GeminiProvider.embed', () => {
  it('maps batch embeddings to vectors', async () => {
    const fetchFn: typeof fetch = async () =>
      jsonResponse({ embeddings: [{ values: [1, 2, 3] }, { values: [4, 5, 6] }] });
    const provider = new GeminiProvider({ apiKey: 'k', fetchFn, queue: fastQueue() });

    expect(await provider.embed(['a', 'b'])).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('returns no vectors for empty input without calling the API', async () => {
    let called = false;
    const fetchFn: typeof fetch = async () => {
      called = true;
      return jsonResponse({});
    };
    const provider = new GeminiProvider({ apiKey: 'k', fetchFn, queue: fastQueue() });

    expect(await provider.embed([])).toEqual([]);
    expect(called).toBe(false);
  });
});
