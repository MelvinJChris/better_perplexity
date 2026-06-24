import { describe, expect, it } from 'vitest';
import { cleanSnippet } from '@/lib/snippet';

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
