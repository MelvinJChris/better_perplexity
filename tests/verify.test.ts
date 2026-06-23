import { describe, expect, it } from 'vitest';
import { extractCitations, splitSentences, verify } from '@/lib/pipeline/verify';
import type { CompleteResult, LlmProvider } from '@/lib/providers/llm';
import type { ScoredSource } from '@/lib/types';

const scored = (url: string, trustScore: number): ScoredSource => ({
  url,
  title: 't',
  snippet: 's',
  rawRelevance: 1,
  trustScore,
  trustReason: 'r',
  corroborations: 0,
});

const completeWith = (text: string): LlmProvider => ({
  async complete(): Promise<CompleteResult> {
    return { text, inputTokens: 0, outputTokens: 0, latencyMs: 0, model: 'm' };
  },
  async *completeStream() {},
  async embed(texts: string[]) {
    return texts.map(() => [0]);
  },
});

describe('splitSentences', () => {
  it('splits prose into trimmed sentences', () => {
    expect(splitSentences('Global demand is 945 TWh. It doubles by 2030. Sources vary.')).toEqual([
      'Global demand is 945 TWh.',
      'It doubles by 2030.',
      'Sources vary.',
    ]);
  });

  it('does not split inside acronyms or common abbreviations', () => {
    expect(
      splitSentences('The U.S. and China lead, e.g. in capacity. The trend continues.'),
    ).toEqual(['The U.S. and China lead, e.g. in capacity.', 'The trend continues.']);
  });

  it('still ends a sentence on a lone single-letter period (vitamin D.)', () => {
    expect(splitSentences('Take vitamin D. The study shows benefit.')).toEqual([
      'Take vitamin D.',
      'The study shows benefit.',
    ]);
  });
});

describe('extractCitations', () => {
  it('maps in-range [n] markers to their sources', () => {
    const sources = [scored('https://iea.org/a', 90), scored('https://eia.gov/b', 88)];
    expect(extractCitations('A [1] and B [2], also bogus [9].', sources)).toEqual([
      { marker: 1, sourceUrl: 'https://iea.org/a' },
      { marker: 2, sourceUrl: 'https://eia.gov/b' },
    ]);
  });
});

describe('verify', () => {
  const sources = [scored('https://iea.org/a', 95), scored('https://blog.x/b', 30)];

  it('flags sentences without high-trust support and surfaces a scope note', async () => {
    const answer = 'Global demand is about 945 TWh [1]. US demand is 600 TWh.';
    const llm = completeWith(
      '{"verdicts":[{"index":0,"supported":true},{"index":1,"supported":false}],"scopeNote":"Sentence 2 uses a US figure for a global question."}',
    );
    const result = await verify(answer, sources, llm);
    expect(result.unsupported).toEqual(['US demand is 600 TWh.']);
    expect(result.citations).toEqual([{ marker: 1, sourceUrl: 'https://iea.org/a' }]);
    expect(result.scopeMismatch).toContain('US figure');
  });

  it('treats a sentence with no verdict as unsupported (never silently dropped)', async () => {
    const answer = 'Claim one. Claim two.';
    const llm = completeWith('{"verdicts":[{"index":0,"supported":true}]}');
    const result = await verify(answer, sources, llm);
    expect(result.unsupported).toEqual(['Claim two.']);
  });
});
