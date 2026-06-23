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

export interface LlmProvider {
  complete(prompt: string, opts?: CompleteOptions): Promise<CompleteResult>;
  embed(texts: string[]): Promise<number[][]>;
}
