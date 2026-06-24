import { describe, expect, it } from 'vitest';
import { contradictionDetected, corroborationProxy, precisionAtK } from '@/lib/eval';
import { scoreTrust } from '@/lib/pipeline/scoreTrust';
import type { Source } from '@/lib/types';

const lead: Source[] = [
  {
    url: 'https://www.cochranelibrary.com/r',
    title: 'review',
    snippet: 'reduced risk by 12 percent',
    rawRelevance: 1,
  },
  { url: 'https://nih.gov/r', title: 'factsheet', snippet: 'about 12 percent', rawRelevance: 1 },
  { url: 'https://www.bmj.com/r', title: 'meta', snippet: 'roughly 12 percent', rawRelevance: 1 },
  {
    url: 'https://www.mercola.com/r',
    title: 'blog',
    snippet: 'cuts risk by 50 percent',
    rawRelevance: 1,
  },
];

describe('corroborationProxy', () => {
  it('clusters comparable values across independent domains and isolates the outlier', () => {
    const counts = corroborationProxy(lead);
    expect(counts['https://www.cochranelibrary.com/r']).toBe(2);
    expect(counts['https://www.mercola.com/r']).toBe(0);
  });
});

describe('precisionAtK and contradictionDetected', () => {
  const scored = scoreTrust(lead, { corroboratingDomains: corroborationProxy(lead) });

  it('puts the expected high-trust domains at the top', () => {
    expect(precisionAtK(scored, ['cochranelibrary.com', 'nih.gov'])).toBe(1);
  });

  it('flags the labeled outlier as a contradiction', () => {
    expect(contradictionDetected(scored, 'https://www.mercola.com/r')).toBe(true);
    expect(contradictionDetected(scored, 'https://www.cochranelibrary.com/r')).toBe(false);
  });
});
