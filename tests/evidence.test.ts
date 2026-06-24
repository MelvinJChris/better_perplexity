import { describe, expect, it } from 'vitest';
import { detectEvidenceLevel, evidenceBonus, evidenceLabel } from '@/lib/pipeline/evidence';

describe('detectEvidenceLevel', () => {
  it('detects each level from study-type language', () => {
    expect(detectEvidenceLevel('A systematic review and meta-analysis of statins')).toBe(
      'systematic-review',
    );
    expect(detectEvidenceLevel('a double-blind, placebo-controlled randomized trial')).toBe('rct');
    expect(detectEvidenceLevel('a prospective cohort study of 10,000 adults')).toBe(
      'observational',
    );
    expect(detectEvidenceLevel('we present a case report of a rare reaction')).toBe('case-report');
    expect(detectEvidenceLevel('an in vitro study in cell culture')).toBe('preclinical');
    expect(detectEvidenceLevel('an editorial on screening policy')).toBe('expert-opinion');
  });

  it('returns the strongest level when several appear', () => {
    expect(detectEvidenceLevel('systematic review of randomized controlled trials')).toBe(
      'systematic-review',
    );
  });

  it('returns null when no study type is mentioned', () => {
    expect(detectEvidenceLevel('vitamin C is great for you, trust me')).toBeNull();
  });
});

describe('evidence ordering', () => {
  it('rewards stronger evidence and penalizes the weakest', () => {
    expect(evidenceBonus('systematic-review')).toBeGreaterThan(evidenceBonus('rct'));
    expect(evidenceBonus('rct')).toBeGreaterThan(evidenceBonus('observational'));
    expect(evidenceBonus('preclinical')).toBeLessThan(0);
  });

  it('labels are human-readable', () => {
    expect(evidenceLabel('systematic-review')).toBe('Systematic review');
    expect(evidenceLabel('rct')).toBe('Randomized trial');
  });
});
