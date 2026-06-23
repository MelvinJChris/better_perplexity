import { describe, expect, it } from 'vitest';
import { claimSchema, claimsSchema } from '@/lib/types';

describe('claim schema validation', () => {
  it('accepts a well-formed claim', () => {
    const result = claimSchema.safeParse({
      sourceUrl: 'https://iea.org/x',
      text: 'Global data center electricity demand could reach ~945 TWh by 2030.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a claim with a non-url source or empty text', () => {
    expect(claimSchema.safeParse({ sourceUrl: 'not-a-url', text: 'x' }).success).toBe(false);
    expect(claimSchema.safeParse({ sourceUrl: 'https://iea.org', text: '' }).success).toBe(false);
  });

  it('validates an array of claims', () => {
    const result = claimsSchema.safeParse([
      { sourceUrl: 'https://iea.org/a', text: 'a' },
      { sourceUrl: 'https://eia.gov/b', text: 'b' },
    ]);
    expect(result.success).toBe(true);
  });
});
