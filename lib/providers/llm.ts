// One interface for every LLM call. Gemini sits behind it for the demo (see
// lib/providers/gemini.ts); swapping providers is a config change. Token counts
// are returned so cost can be measured from real usage, not estimated.

export interface CompleteOptions {
  model?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CompleteResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** Captured for the per-query trace (latency and cost metrics). */
  latencyMs: number;
  model: string;
}

/** A streamed completion fragment. Token counts arrive on the final chunk, when
 *  the provider reports usage; text-only chunks leave them undefined. */
export interface CompleteChunk {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LlmProvider {
  complete(prompt: string, opts?: CompleteOptions): Promise<CompleteResult>;
  /** Streams the answer so the client can show partial results (see #9). */
  completeStream(prompt: string, opts?: CompleteOptions): AsyncIterable<CompleteChunk>;
  embed(texts: string[]): Promise<number[][]>;
}
