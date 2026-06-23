import { describe, expect, it } from 'vitest';
import { extractMetricValue } from '@/lib/metrics';
import { trustTier } from '@/lib/trust';

describe('extractMetricValue', () => {
  it('returns the salient magnitude and skips bare years', () => {
    expect(extractMetricValue('about 945 TWh by 2030')).toBe(945);
  });

  it('handles thousands separators', () => {
    expect(extractMetricValue('demand could reach 1,050 TWh')).toBe(1050);
  });

  it('applies magnitude words', () => {
    expect(extractMetricValue('roughly 1.2 billion devices')).toBe(1.2e9);
  });

  it('returns null when there is no comparable number', () => {
    expect(extractMetricValue('a qualitative outlook with no figures')).toBeNull();
    expect(extractMetricValue('published in 2030')).toBeNull();
  });
});

describe('trustTier', () => {
  it('buckets scores into high, mid, and low', () => {
    expect(trustTier(90)).toBe('high');
    expect(trustTier(75)).toBe('high');
    expect(trustTier(60)).toBe('mid');
    expect(trustTier(49)).toBe('low');
  });
});
