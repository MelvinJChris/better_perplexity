import { describe, expect, it } from 'vitest';
import { ProviderError } from '@/lib/providers/errors';
import { searchExa } from '@/lib/providers/exa';
import { searchTavily } from '@/lib/providers/tavily';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

interface Call {
  init?: RequestInit;
}

describe('searchTavily', () => {
  it('maps results into Source and sets bearer auth', async () => {
    const calls: Call[] = [];
    const fetchFn: typeof fetch = async (_url, init) => {
      calls.push({ init });
      return jsonResponse({
        results: [
          {
            title: 'T',
            url: 'https://iea.org/a',
            content: 'snip',
            raw_content: 'full',
            score: 0.9,
          },
        ],
      });
    };

    const out = await searchTavily('q', { apiKey: 'tk', fetchFn });
    expect(out).toEqual([
      { url: 'https://iea.org/a', title: 'T', snippet: 'snip', text: 'full', rawRelevance: 0.9 },
    ]);
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tk');
  });

  it('drops results without a url', async () => {
    const fetchFn: typeof fetch = async () =>
      jsonResponse({ results: [{ title: 'no url' }, { url: 'https://x.org/a' }] });
    const out = await searchTavily('q', { apiKey: 'tk', fetchFn });
    expect(out.map((s) => s.url)).toEqual(['https://x.org/a']);
  });

  it('throws ProviderError on a non-ok response', async () => {
    const fetchFn: typeof fetch = async () => new Response('nope', { status: 401 });
    await expect(searchTavily('q', { apiKey: 'tk', fetchFn })).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});

describe('searchExa', () => {
  it('maps results into Source and sets x-api-key auth', async () => {
    const calls: Call[] = [];
    const fetchFn: typeof fetch = async (_url, init) => {
      calls.push({ init });
      return jsonResponse({
        results: [{ title: 'E', url: 'https://exa.example/a', text: 'body text', score: 0.7 }],
      });
    };

    const out = await searchExa('q', { apiKey: 'ek', fetchFn });
    expect(out[0]).toMatchObject({
      url: 'https://exa.example/a',
      title: 'E',
      snippet: 'body text',
      rawRelevance: 0.7,
    });
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('ek');
  });

  it('throws ProviderError on a non-ok response', async () => {
    const fetchFn: typeof fetch = async () => new Response('err', { status: 500 });
    await expect(searchExa('q', { apiKey: 'ek', fetchFn })).rejects.toBeInstanceOf(ProviderError);
  });
});
