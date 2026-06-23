import { describe, expect, it } from 'vitest';
import { domainPrior, hostOf } from '@/lib/pipeline/domainPrior';

describe('hostOf', () => {
  it('strips www and lowercases', () => {
    expect(hostOf('https://WWW.IEA.org/reports/x')).toBe('iea.org');
  });

  it('returns empty string for an unparseable url', () => {
    expect(hostOf('not a url')).toBe('');
  });
});

describe('domainPrior', () => {
  it('ranks a curated authority above an unknown blog', () => {
    expect(domainPrior('https://www.iea.org/report')).toBeGreaterThan(
      domainPrior('https://some-random-blog.example/post'),
    );
  });

  it('gives government and edu domains a high prior', () => {
    expect(domainPrior('https://eia.gov/data')).toBeGreaterThanOrEqual(88);
    expect(domainPrior('https://mit.edu/x')).toBeGreaterThanOrEqual(88);
  });

  it('matches subdomains of a curated domain', () => {
    expect(domainPrior('https://data.iea.org/x')).toBe(95);
  });

  it('falls back to a neutral prior for an unknown unparseable url', () => {
    expect(domainPrior('garbage')).toBe(30);
  });
});
