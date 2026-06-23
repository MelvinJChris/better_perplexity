import { describe, expect, it } from 'vitest';
import { parseNdjson } from '@/lib/client/searchStream';
import type { SearchEvent } from '@/lib/pipeline/runSearch';

/** Builds a byte stream that emits the given string chunks in order, so we can
 *  exercise line splits that straddle chunk boundaries. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<SearchEvent[]> {
  const out: SearchEvent[] = [];
  for await (const event of parseNdjson(stream)) out.push(event);
  return out;
}

describe('parseNdjson', () => {
  it('parses one event per line', async () => {
    const events = await collect(
      streamOf([
        '{"type":"sources","sources":[]}\n',
        '{"type":"token","text":"hi"}\n',
        '{"type":"trace","trace":{"query":"q","sourceCount":0,"synthesisModel":"m","inputTokens":1,"outputTokens":2,"latencyMs":3}}\n',
      ]),
    );
    expect(events.map((e) => e.type)).toEqual(['sources', 'token', 'trace']);
  });

  it('reassembles a JSON line split across chunk boundaries', async () => {
    const events = await collect(streamOf(['{"type":"to', 'ken","text":"hel', 'lo"}\n']));
    expect(events).toEqual([{ type: 'token', text: 'hello' }]);
  });

  it('emits a final line that has no trailing newline', async () => {
    const events = await collect(streamOf(['{"type":"error","message":"boom"}']));
    expect(events).toEqual([{ type: 'error', message: 'boom' }]);
  });

  it('ignores blank lines', async () => {
    const events = await collect(streamOf(['\n{"type":"token","text":"a"}\n\n']));
    expect(events).toEqual([{ type: 'token', text: 'a' }]);
  });
});
