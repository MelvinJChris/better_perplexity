import { describe, expect, it } from 'vitest';
import { contradictionDetected, corroborationProxy, precisionAtK } from '@/lib/eval';
import { scoreTrust } from '@/lib/pipeline/scoreTrust';
import type { Source } from '@/lib/types';

const lead: Source[] = [
  {
    url: 'https://www.iea.org/r',
    title: 'demand',
    snippet: 'about 945 TWh by 2030',
    rawRelevance: 1,
  },
  { url: 'https://eia.gov/r', title: 'demand', snippet: 'near 970 TWh in 2030', rawRelevance: 1 },
  {
    url: 'https://reuters.com/r',
    title: 'demand',
    snippet: 'around 960 TWh by 2030',
    rawRelevance: 1,
  },
  {
    url: 'https://blog.example/us',
    title: 'us',
    snippet: 'US data centers 600 TWh by 2030',
    rawRelevance: 1,
  },
];

describe('corroborationProxy', () => {
  it('clusters comparable values across independent domains and isolates the outlier', () => {
    const counts = corroborationProxy(lead);
    expect(counts['https://www.iea.org/r']).toBe(2);
    expect(counts['https://blog.example/us']).toBe(0);
  });
});

describe('precisionAtK and contradictionDetected', () => {
  const scored = scoreTrust(lead, { corroboratingDomains: corroborationProxy(lead) });

  it('puts the expected high-trust domains at the top', () => {
    expect(precisionAtK(scored, ['iea.org', 'eia.gov'])).toBe(1);
  });

  it('flags the labeled outlier as a contradiction', () => {
    expect(contradictionDetected(scored, 'https://blog.example/us')).toBe(true);
    expect(contradictionDetected(scored, 'https://www.iea.org/r')).toBe(false);
  });
});
