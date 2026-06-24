import { describe, expect, it } from 'vitest';
import { domainPrior, hostOf, sourceKind } from '@/lib/pipeline/domainPrior';

describe('hostOf', () => {
  it('strips www and lowercases', () => {
    expect(hostOf('https://WWW.NEJM.org/doi/x')).toBe('nejm.org');
  });

  it('returns empty string for an unparseable url', () => {
    expect(hostOf('not a url')).toBe('');
  });
});

describe('domainPrior', () => {
  it('ranks a clinical authority above a wellness blog', () => {
    expect(domainPrior('https://www.cochranelibrary.com/cdsr/x')).toBeGreaterThan(
      domainPrior('https://www.mercola.com/article'),
    );
  });

  it('gives public-health and academic domains a high prior', () => {
    expect(domainPrior('https://cdc.gov/topic')).toBeGreaterThanOrEqual(90);
    expect(domainPrior('https://hms.harvard.edu/x')).toBeGreaterThanOrEqual(82);
  });

  it('matches subdomains of a curated domain', () => {
    expect(domainPrior('https://pubmed.ncbi.nlm.nih.gov/123')).toBe(93);
  });

  it('downranks supplement and forum sources', () => {
    expect(domainPrior('https://naturalnews.com/x')).toBeLessThan(40);
    expect(domainPrior('https://www.reddit.com/r/health')).toBeLessThan(50);
  });

  it('falls back to a neutral prior for an unknown unparseable url', () => {
    expect(domainPrior('garbage')).toBe(30);
  });
});

describe('sourceKind', () => {
  it('labels clinical source kinds', () => {
    expect(sourceKind('https://www.cochranelibrary.com/x')).toBe('Systematic review');
    expect(sourceKind('https://www.nejm.org/x')).toBe('Peer-reviewed journal');
    expect(sourceKind('https://who.int/x')).toBe('Public health authority');
    expect(sourceKind('https://www.fda.gov/x')).toBe('Regulator');
    expect(sourceKind('https://www.healthline.com/x')).toBe('Consumer health');
    expect(sourceKind('https://mercola.com/x')).toBe('Wellness / marketing');
    expect(sourceKind('https://some-clinic.edu/x')).toBe('Academic');
    expect(sourceKind('https://random-blog.example/x')).toBe('Web source');
  });
});
