import { describe, expect, it } from 'vitest';
import { ndjsonStream, runSearchEvents, type SearchEvent } from '@/lib/pipeline/runSearch';
import type { CompleteChunk, LlmProvider } from '@/lib/providers/llm';
import type { SearchProvider } from '@/lib/providers/search';
import type { Source } from '@/lib/types';

const src = (url: string): Source => ({ url, title: 't', snippet: 's', rawRelevance: 1 });

const llmOf = (chunks: CompleteChunk[]): LlmProvider => ({
  complete: async () => {
    throw new Error('unused');
  },
  async *completeStream() {
    for (const chunk of chunks) yield chunk;
  },
  embed: async (texts) => texts.map(() => [1, 0]),
});

const searchOf = (result: Source[] | Error): SearchProvider => ({
  search: async () => {
    if (result instanceof Error) throw result;
    return result;
  },
});

async function collect(events: AsyncIterable<SearchEvent>): Promise<SearchEvent[]> {
  const out: SearchEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

describe('runSearchEvents', () => {
  it('emits sources, then answer tokens, then a trace', async () => {
    const events = await collect(
      runSearchEvents('q', {
        search: searchOf([src('https://iea.org/a'), src('https://eia.gov/b')]),
        llm: llmOf([{ text: 'Answer ' }, { text: '[1]', inputTokens: 200, outputTokens: 7 }]),
        synthesisModel: 'gemini-2.5-flash',
        now: () => 0,
      }),
    );

    const first = events[0];
    expect(first.type).toBe('sources');
    if (first.type === 'sources') {
      expect(first.sources).toHaveLength(2);
      expect(first.sources[0]).toHaveProperty('trustScore');
      // Both stub embeddings agree and sit on different domains, so each is
      // corroborated by the other's domain (the trust pipeline is wired in).
      expect(first.sources[0].corroborations).toBe(1);
    }

    const answer = events
      .filter((e): e is Extract<SearchEvent, { type: 'token' }> => e.type === 'token')
      .map((e) => e.text)
      .join('');
    expect(answer).toBe('Answer [1]');

    const last = events.at(-1);
    expect(last?.type).toBe('trace');
    if (last?.type === 'trace') {
      expect(last.trace.sourceCount).toBe(2);
      expect(last.trace.inputTokens).toBe(200);
      expect(last.trace.outputTokens).toBe(7);
      expect(last.trace.synthesisModel).toBe('gemini-2.5-flash');
    }
  });

  it('emits a single terminal error event when retrieval fails', async () => {
    const events = await collect(
      runSearchEvents('q', {
        search: searchOf(new Error('all providers down')),
        llm: llmOf([{ text: 'unused' }]),
      }),
    );
    expect(events).toEqual([{ type: 'error', message: 'all providers down' }]);
  });
});

describe('ndjsonStream', () => {
  it('encodes each event as one newline-delimited JSON line', async () => {
    async function* gen(): AsyncIterable<SearchEvent> {
      yield { type: 'token', text: 'a' };
      yield { type: 'token', text: 'b' };
    }
    const text = await new Response(ndjsonStream(gen())).text();
    expect(text).toBe('{"type":"token","text":"a"}\n{"type":"token","text":"b"}\n');
  });
});
