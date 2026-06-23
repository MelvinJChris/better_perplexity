// Deterministic domain prior: a small curated credibility table plus TLD
// heuristics. This is the static half of the trust score; cross-source
// corroboration and recency are added in #13.

const CURATED: Record<string, number> = {
  'iea.org': 95,
  'irena.org': 90,
  'nature.com': 92,
  'science.org': 92,
  'iea.blob.core.windows.net': 90,
  'eia.gov': 90,
  'nrel.gov': 90,
  'reuters.com': 82,
  'apnews.com': 82,
  'ft.com': 80,
  'economist.com': 80,
  'mckinsey.com': 75,
  'wikipedia.org': 70,
  'medium.com': 40,
};

/** Returns the bare host without a leading www. Empty string if unparseable. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Credibility prior in the range 0 to 100. */
export function domainPrior(url: string): number {
  const host = hostOf(url);
  if (!host) return 30;

  for (const [domain, score] of Object.entries(CURATED)) {
    if (host === domain || host.endsWith(`.${domain}`)) return score;
  }

  if (host.endsWith('.gov') || host.endsWith('.int') || host.endsWith('.edu')) return 88;
  if (host.endsWith('.ac.uk') || host.endsWith('.gov.uk')) return 88;
  if (host.endsWith('.org')) return 60;

  return 50;
}
