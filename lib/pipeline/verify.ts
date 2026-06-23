import type { LlmProvider } from '@/lib/providers/llm';
import { notImplemented } from '@/lib/notImplemented';
import type { ScoredSource, VerifiedAnswer } from '@/lib/types';

// Real implementation in #15: per answer sentence, confirm support from a
// high-trust source; collect the unsupported sentences.
export async function verify(
  _answer: string,
  _sources: ScoredSource[],
  _llm: LlmProvider,
): Promise<VerifiedAnswer> {
  return notImplemented('verify');
}
