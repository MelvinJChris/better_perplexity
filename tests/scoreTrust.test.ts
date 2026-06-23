import { describe, expect, it } from 'vitest';
import { scoreTrust } from '@/lib/pipeline/scoreTrust';
import type { Source } from '@/lib/types';

const src = (url: string): Source => ({
  url,
  title: 't',
  snippet: 's',
  rawRelevance: 1,
});

describe('scoreTrust', () => {
  const scored = scoreTrust([
    src('https://some-content-farm.example/post'),
    src('https://www.iea.org/reports/electricity-2024'),
    src('https://eia.gov/electricity'),
  ]);

  it('reranks high-credibility sources above weak ones', () => {
    expect(scored[0].trustScore).toBeGreaterThan(scored[scored.length - 1].trustScore);
    expect(scored[scored.length - 1].url).toContain('content-farm');
  });

  it('attaches a score in range, a reason, and a corroboration count to every source', () => {
    for (const s of scored) {
      expect(s.trustScore).toBeGreaterThanOrEqual(0);
      expect(s.trustScore).toBeLessThanOrEqual(100);
      expect(s.trustReason.length).toBeGreaterThan(0);
      expect(s.corroborations).toBe(0);
    }
  });

  it('raises the score and explains when a source is corroborated', () => {
    const url = 'https://reuters.com/article';
    const [plain] = scoreTrust([src(url)]);
    const [corroborated] = scoreTrust([src(url)], { corroboratingDomains: { [url]: 3 } });
    expect(corroborated.trustScore).toBeGreaterThan(plain.trustScore);
    expect(corroborated.corroborations).toBe(3);
    expect(corroborated.trustReason).toContain('3 independent domains');
    expect(plain.trustReason).toContain('not yet corroborated');
  });

  it('applies a recency adjustment from age in days', () => {
    const url = 'https://reuters.com/article';
    const [recent] = scoreTrust([src(url)], { ageDays: { [url]: 30 } });
    const [stale] = scoreTrust([src(url)], { ageDays: { [url]: 365 * 6 } });
    expect(recent.trustScore).toBeGreaterThan(stale.trustScore);
    expect(recent.trustReason).toContain('recent');
    expect(stale.trustReason).toContain('older source');
  });

  it('ranks the corroborated high-trust cluster above an uncorroborated outlier (lead query)', () => {
    const cluster = [
      'https://www.iea.org/data-centres',
      'https://eia.gov/data-centres',
      'https://reuters.com/data-centres',
    ];
    const outlier = 'https://random-blog.example/data-centres';
    const corroboratingDomains = {
      [cluster[0]]: 2,
      [cluster[1]]: 2,
      [cluster[2]]: 2,
      [outlier]: 0,
    };
    const ranked = scoreTrust([...cluster, outlier].map(src), { corroboratingDomains });
    expect(ranked[ranked.length - 1].url).toBe(outlier);
    expect(
      ranked
        .slice(0, 3)
        .map((s) => s.url)
        .sort(),
    ).toEqual([...cluster].sort());
  });
});
