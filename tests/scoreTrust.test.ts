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

  it('attaches a trust score and a one-line reason to every source', () => {
    for (const s of scored) {
      expect(s.trustScore).toBeGreaterThanOrEqual(0);
      expect(s.trustScore).toBeLessThanOrEqual(100);
      expect(s.trustReason.length).toBeGreaterThan(0);
    }
  });
});
