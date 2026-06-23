import { describe, expect, it } from 'vitest';
import { estimateCostUsd, FREE_TIER_RATES, PROJECTED_RATES } from '@/lib/trace/cost';

describe('estimateCostUsd', () => {
  it('is zero on the free tier regardless of usage', () => {
    expect(estimateCostUsd(1_000_000, 500_000, 5, FREE_TIER_RATES)).toBe(0);
  });

  it('combines token and search-call costs at projected rates', () => {
    // 1M input + 1M output + 10 searches = 0.1 + 0.4 + 0.08.
    expect(estimateCostUsd(1_000_000, 1_000_000, 10, PROJECTED_RATES)).toBeCloseTo(0.58, 10);
  });

  it('defaults to the free tier', () => {
    expect(estimateCostUsd(9_999, 9_999, 9)).toBe(0);
  });
});
