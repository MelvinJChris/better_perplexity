import { describe, expect, it } from 'vitest';
import { dominantUnit, extractMetric, extractMetricValue } from '@/lib/metrics';
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

describe('extractMetric (unit-aware)', () => {
  it('pairs the salient number with a recognized unit, skipping the year', () => {
    expect(extractMetric('about 945 TWh by 2030')).toEqual({ value: 945, unit: 'TWh' });
  });

  it('recognizes percentages and currency', () => {
    expect(extractMetric('grew 17% last year')).toEqual({ value: 17, unit: '%' });
    expect(extractMetric('costs 115 USD per pack')).toEqual({ value: 115, unit: 'USD' });
    expect(extractMetric('a rise of 76 cm')).toEqual({ value: 76, unit: 'cm' });
  });

  it('returns null for numbers without a comparable unit (the noise #46 filters)', () => {
    expect(extractMetric('63,610 followers on the page')).toBeNull();
    expect(extractMetric('roughly 1.2 billion devices')).toBeNull();
    expect(extractMetric('published in 2030')).toBeNull();
  });
});

describe('dominantUnit', () => {
  it('is the most common shared unit', () => {
    expect(dominantUnit(['945 TWh', '970 TWh', 'up 17%'])).toBe('TWh');
  });

  it('is null when no unit is shared by at least two sources', () => {
    expect(dominantUnit(['945 TWh', 'up 17%'])).toBeNull();
    expect(dominantUnit(['no numbers here', 'nor here'])).toBeNull();
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
