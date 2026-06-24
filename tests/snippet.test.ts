import { describe, expect, it } from 'vitest';
import { cleanSnippet, previewSnippet } from '@/lib/snippet';

describe('cleanSnippet', () => {
  it('strips heading markers', () => {
    expect(cleanSnippet('### Conclusion Current evidence suggests fasting helps')).toBe(
      'Conclusion Current evidence suggests fasting helps',
    );
  });

  it('strips emphasis and link syntax, keeping the text', () => {
    expect(cleanSnippet('**bold** and _italic_ with a [study](https://x.org)')).toBe(
      'bold and italic with a study',
    );
  });

  it('collapses whitespace and newlines', () => {
    expect(cleanSnippet('line one\n\n  line two')).toBe('line one line two');
  });

  it('returns clean prose unchanged', () => {
    expect(cleanSnippet('Vitamin D reduced risk by about 12 percent.')).toBe(
      'Vitamin D reduced risk by about 12 percent.',
    );
  });
});

describe('previewSnippet', () => {
  it('truncates to a sentence boundary, dropping trailing junk', () => {
    const raw =
      'A supplementation of 0.2 g/day of vitamin C may be reasonable in subjects with low plasma vitamin C concentration. Subjects with NCDsImage and more trailing text that runs well past the limit here.';
    expect(previewSnippet(raw, 120)).toBe(
      'A supplementation of 0.2 g/day of vitamin C may be reasonable in subjects with low plasma vitamin C concentration.',
    );
  });

  it('falls back to a word boundary with an ellipsis when no sentence end fits', () => {
    const raw = 'wordone wordtwo wordthree wordfour wordfive wordsix wordseven wordeight';
    const out = previewSnippet(raw, 30);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('word eight');
    expect(out.length).toBeLessThanOrEqual(31);
  });

  it('returns short snippets unchanged', () => {
    expect(previewSnippet('Short and clean.', 220)).toBe('Short and clean.');
  });
});
