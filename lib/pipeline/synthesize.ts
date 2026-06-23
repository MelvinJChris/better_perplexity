import type { LlmProvider } from '@/lib/providers/llm';
import { notImplemented } from '@/lib/notImplemented';
import type { ScoredSource } from '@/lib/types';

// Real implementation in #9 and #13: Flash composes the answer from
// trust-weighted sources, with every claim cited.
export async function synthesize(
  _query: string,
  _sources: ScoredSource[],
  _llm: LlmProvider,
): Promise<string> {
  return notImplemented('synthesize');
}
