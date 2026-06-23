import { notImplemented } from '@/lib/notImplemented';

// One interface for every LLM call. Gemini sits behind it for the demo;
// swapping providers is a config change (see #7). Token counts are returned
// so cost can be measured from real usage, not estimated.

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
}

export interface LlmProvider {
  complete(prompt: string, opts?: CompleteOptions): Promise<CompleteResult>;
  embed(texts: string[]): Promise<number[][]>;
}

/** Placeholder until the Gemini provider lands in #7. */
export const stubLlmProvider: LlmProvider = {
  async complete() {
    return notImplemented('llmProvider.complete');
  },
  async embed() {
    return notImplemented('llmProvider.embed');
  },
};
