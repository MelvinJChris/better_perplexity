import { getEnv } from '@/lib/env';
import { ProviderError } from '@/lib/providers/errors';
import type {
  CompleteChunk,
  CompleteOptions,
  CompleteResult,
  LlmProvider,
} from '@/lib/providers/llm';
import { RateLimitQueue } from '@/lib/providers/rateLimitQueue';

// Gemini behind the llmProvider interface. The free tier is the demo default;
// swapping to Claude or GPT in production is a config change, not a rewrite.
//
// Model ids change often, so they are env-overridable. Confirm the current ids
// in Google AI Studio (see CLAUDE.md). Flash-Lite handles high-volume
// extraction/classification; Flash handles synthesis.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_COMPLETE_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_SYNTHESIS_MODEL = 'gemini-2.5-flash';
const DEFAULT_EMBED_MODEL = 'text-embedding-004';
const DEFAULT_RPM = 15;

export interface GeminiConfig {
  apiKey: string;
  completeModel?: string;
  synthesisModel?: string;
  embedModel?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchFn?: typeof fetch;
  /** Injectable for tests; defaults to a free-tier-safe queue. */
  queue?: RateLimitQueue;
}

interface GeminiGenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

interface GeminiBatchEmbedResponse {
  embeddings?: { values?: number[] }[];
}

export class GeminiProvider implements LlmProvider {
  readonly completeModel: string;
  readonly synthesisModel: string;
  readonly embedModel: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly queue: RateLimitQueue;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.completeModel = config.completeModel ?? DEFAULT_COMPLETE_MODEL;
    this.synthesisModel = config.synthesisModel ?? DEFAULT_SYNTHESIS_MODEL;
    this.embedModel = config.embedModel ?? DEFAULT_EMBED_MODEL;
    this.fetchFn = config.fetchFn ?? fetch;
    this.queue =
      config.queue ??
      new RateLimitQueue({
        maxConcurrent: 4,
        minIntervalMs: Math.ceil(60000 / DEFAULT_RPM),
        maxRetries: 4,
        baseDelayMs: 500,
        maxDelayMs: 20000,
      });
  }

  async complete(prompt: string, opts?: CompleteOptions): Promise<CompleteResult> {
    const model = opts?.model ?? this.completeModel;
    const started = Date.now();
    const json = (await this.queue.add(() =>
      this.post(`${GEMINI_BASE}/models/${model}:generateContent`, buildGenerateBody(prompt, opts)),
    )) as GeminiGenerateResponse;
    const latencyMs = Date.now() - started;

    const usage = json.usageMetadata ?? {};
    return {
      text: partsText(json),
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
      latencyMs,
      model,
    };
  }

  async *completeStream(prompt: string, opts?: CompleteOptions): AsyncIterable<CompleteChunk> {
    const model = opts?.model ?? this.completeModel;
    // The queue gates the connection (concurrency + RPM + retry on a transient
    // status); the body is then streamed outside the slot.
    const res = await this.queue.add(() =>
      this.postRaw(
        `${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse`,
        buildGenerateBody(prompt, opts),
      ),
    );
    for await (const json of parseSseStream(res)) {
      const usage = json.usageMetadata;
      yield {
        text: partsText(json),
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
      };
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const body = {
      requests: texts.map((text) => ({
        model: `models/${this.embedModel}`,
        content: { parts: [{ text }] },
      })),
    };
    const json = (await this.queue.add(() =>
      this.post(`${GEMINI_BASE}/models/${this.embedModel}:batchEmbedContents`, body),
    )) as GeminiBatchEmbedResponse;
    return (json.embeddings ?? []).map((embedding) => embedding.values ?? []);
  }

  private async post(url: string, body: unknown): Promise<unknown> {
    const res = await this.postRaw(url, body);
    return res.json();
  }

  /** POST and return the raw Response (status-checked), for streaming callers. */
  private async postRaw(url: string, body: unknown): Promise<Response> {
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new ProviderError(`Gemini ${res.status}: ${detail.slice(0, 200)}`, res.status);
    }
    return res;
  }
}

/** Builds the generateContent request body shared by complete and completeStream. */
function buildGenerateBody(prompt: string, opts?: CompleteOptions): Record<string, unknown> {
  const generationConfig: Record<string, number> = {};
  if (opts?.temperature !== undefined) generationConfig.temperature = opts.temperature;
  if (opts?.maxTokens !== undefined) generationConfig.maxOutputTokens = opts.maxTokens;

  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(opts?.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  };
}

/** Concatenates the text parts of the first candidate. */
function partsText(json: GeminiGenerateResponse): string {
  return (json.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
}

/** Parses a Gemini SSE stream (alt=sse), yielding one response object per
 *  `data:` line. Tolerates chunk boundaries splitting lines mid-stream. */
async function* parseSseStream(res: Response): AsyncIterable<GeminiGenerateResponse> {
  const body = res.body;
  if (!body) return;
  const reader = body.getReader();
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
      if (!line.startsWith('data:')) continue;
      const payload = line.slice('data:'.length).trim();
      if (!payload || payload === '[DONE]') continue;
      yield JSON.parse(payload) as GeminiGenerateResponse;
    }
  }
}

export function createGeminiProvider(config: GeminiConfig): GeminiProvider {
  return new GeminiProvider(config);
}

/** Builds the provider from environment (secrets + optional model overrides). */
export function geminiFromEnv(): GeminiProvider {
  return new GeminiProvider({
    apiKey: getEnv().GEMINI_API_KEY,
    completeModel: process.env.GEMINI_COMPLETE_MODEL,
    synthesisModel: process.env.GEMINI_SYNTHESIS_MODEL,
    embedModel: process.env.GEMINI_EMBED_MODEL,
  });
}
