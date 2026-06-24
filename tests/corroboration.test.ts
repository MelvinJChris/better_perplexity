import { describe, expect, it } from 'vitest';
import { countCorroboratingDomains, flagNearDuplicates } from '@/lib/pipeline/corroboration';
import type { Source } from '@/lib/types';

const src = (url: string): Source => ({ url, title: 't', snippet: 's', rawRelevance: 1 });

describe('countCorroboratingDomains', () => {
  it('counts agreement across independent domains only', () => {
    const sources = [src('https://iea.org/a'), src('https://eia.gov/b'), src('https://blog.x/c')];
    const embeddings = [
      [1, 0], // iea: ~945 cluster
      [0.99, 0.02], // eia: agrees with iea
      [0, 1], // blog: an outlier
    ];
    expect(countCorroboratingDomains(sources, embeddings, 0.82)).toEqual([1, 1, 0]);
  });

  it('does not let a domain corroborate itself', () => {
    const sources = [src('https://iea.org/a'), src('https://iea.org/b')];
    const embeddings = [
      [1, 0],
      [1, 0],
    ];
    expect(countCorroboratingDomains(sources, embeddings, 0.82)).toEqual([0, 0]);
  });

  it('counts each agreeing domain once even with multiple matches', () => {
    const sources = [src('https://iea.org/a'), src('https://eia.gov/b'), src('https://eia.gov/c')];
    const embeddings = [
      [1, 0],
      [1, 0],
      [0.98, 0.01],
    ];
    // iea agrees with eia.gov (one distinct domain), despite two eia pages.
    expect(countCorroboratingDomains(sources, embeddings, 0.82)[0]).toBe(1);
  });
});

describe('flagNearDuplicates', () => {
  it('flags a later near-identical copy, keeping the first', () => {
    const sources = [src('https://a.org/1'), src('https://b.org/2'), src('https://c.org/3')];
    const embeddings = [
      [1, 0],
      [0.999, 0.001], // syndicated copy of the first
      [0, 1],
    ];
    expect(flagNearDuplicates(sources, embeddings, 0.95)).toEqual([false, true, false]);
  });
});
