import type { LlmProvider } from '@/lib/providers/llm';
import { notImplemented } from '@/lib/notImplemented';
import type { Claim, Source } from '@/lib/types';

// Real implementation in #11: Flash-Lite extracts atomic claims per source as
// schema-validated JSON, with a retry on bad parse.
export async function extractClaims(_source: Source, _llm: LlmProvider): Promise<Claim[]> {
  return notImplemented('extractClaims');
}
