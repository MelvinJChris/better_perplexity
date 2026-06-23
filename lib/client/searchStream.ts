import type { SearchEvent } from '@/lib/pipeline/runSearch';
import type { ThreadContext } from '@/lib/pipeline/synthesize';

// Client-side reader for the /api/search NDJSON stream. parseNdjson is pure over
// a byte stream so it is unit-tested (CLAUDE.md lists client parsing as TDD);
// streamSearch wraps the fetch and surfaces transport failures as error events.

/** Yields one SearchEvent per newline-delimited JSON line, tolerating chunk
 *  boundaries that split a line and a final line without a trailing newline. */
export async function* parseNdjson(stream: ReadableStream<Uint8Array>): AsyncIterable<SearchEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as SearchEvent;
    }
  }
  const tail = buffer.trim();
  if (tail) yield JSON.parse(tail) as SearchEvent;
}

/** POSTs the query and streams parsed events. A non-OK response or missing body
 *  becomes a single terminal error event so callers handle one failure path. */
export async function* streamSearch(
  query: string,
  signal?: AbortSignal,
  context?: ThreadContext,
): AsyncIterable<SearchEvent> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, context }),
    signal,
  });

  if (!res.ok || !res.body) {
    let message = `Search request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Keep the status-based message.
    }
    yield { type: 'error', message };
    return;
  }

  yield* parseNdjson(res.body);
}
