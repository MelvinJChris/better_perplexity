// Clinical credibility model (the vertical's moat asset). Sources are scored by a
// curated, evidence-based hierarchy: systematic reviews and major journals and
// public-health authorities at the top; clinical references below; consumer
// health portals mid; wellness/supplement marketing and forums low. This table
// is the defensible, expert-maintained part, not the scoring code around it.
// Deterministic, so it is unit-tested. Recency and corroboration are layered on
// in scoreTrust; the evidence-level signal is added in #54.

interface DomainInfo {
  prior: number;
  kind: string;
}

const CURATED: Record<string, DomainInfo> = {
  // Systematic reviews and evidence synthesis (the top of the evidence pyramid).
  'cochranelibrary.com': { prior: 98, kind: 'Systematic review' },
  'cochrane.org': { prior: 96, kind: 'Systematic review' },
  // Major peer-reviewed journals.
  'nejm.org': { prior: 96, kind: 'Peer-reviewed journal' },
  'thelancet.com': { prior: 96, kind: 'Peer-reviewed journal' },
  'jamanetwork.com': { prior: 95, kind: 'Peer-reviewed journal' },
  'bmj.com': { prior: 94, kind: 'Peer-reviewed journal' },
  'annals.org': { prior: 94, kind: 'Peer-reviewed journal' },
  'nature.com': { prior: 92, kind: 'Peer-reviewed journal' },
  'science.org': { prior: 92, kind: 'Peer-reviewed journal' },
  'cell.com': { prior: 92, kind: 'Peer-reviewed journal' },
  // Research index / primary literature.
  'pubmed.ncbi.nlm.nih.gov': { prior: 93, kind: 'Research index' },
  'ncbi.nlm.nih.gov': { prior: 90, kind: 'Research index' },
  // Public-health authorities and regulators.
  'who.int': { prior: 95, kind: 'Public health authority' },
  'cdc.gov': { prior: 93, kind: 'Public health authority' },
  'nih.gov': { prior: 93, kind: 'Public health authority' },
  'fda.gov': { prior: 92, kind: 'Regulator' },
  'ema.europa.eu': { prior: 90, kind: 'Regulator' },
  'nice.org.uk': { prior: 92, kind: 'Clinical guideline' },
  // Clinical references.
  'medlineplus.gov': { prior: 88, kind: 'Clinical reference' },
  'uptodate.com': { prior: 88, kind: 'Clinical reference' },
  'mayoclinic.org': { prior: 82, kind: 'Clinical reference' },
  'clevelandclinic.org': { prior: 80, kind: 'Clinical reference' },
  'drugs.com': { prior: 70, kind: 'Drug reference' },
  'examine.com': { prior: 72, kind: 'Evidence review' },
  // Consumer health portals.
  'healthline.com': { prior: 62, kind: 'Consumer health' },
  'webmd.com': { prior: 62, kind: 'Consumer health' },
  'medicalnewstoday.com': { prior: 60, kind: 'Consumer health' },
  'verywellhealth.com': { prior: 60, kind: 'Consumer health' },
  // Forums and user-generated.
  'reddit.com': { prior: 35, kind: 'Forum' },
  'quora.com': { prior: 30, kind: 'Forum' },
  // Wellness / supplement marketing (downranked, not banned).
  'goop.com': { prior: 20, kind: 'Wellness / marketing' },
  'draxe.com': { prior: 22, kind: 'Wellness / marketing' },
  'mercola.com': { prior: 18, kind: 'Wellness / marketing' },
  'naturalnews.com': { prior: 15, kind: 'Wellness / marketing' },
};

/** Returns the bare host without a leading www. Empty string if unparseable. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function lookup(url: string): DomainInfo | null {
  const host = hostOf(url);
  if (!host) return null;
  for (const [domain, info] of Object.entries(CURATED)) {
    if (host === domain || host.endsWith(`.${domain}`)) return info;
  }
  return null;
}

/** Credibility prior in the range 0 to 100. */
export function domainPrior(url: string): number {
  const host = hostOf(url);
  if (!host) return 30;

  const curated = lookup(url);
  if (curated) return curated.prior;

  if (host.endsWith('.gov') || host.endsWith('.gov.uk')) return 90;
  if (host.endsWith('.int')) return 90;
  if (host.endsWith('.edu') || host.endsWith('.ac.uk')) return 82;
  if (host.endsWith('.org')) return 55;
  return 42;
}

/** A short, human credibility category for a source (shown on its scorecard). */
export function sourceKind(url: string): string {
  const host = hostOf(url);
  if (!host) return 'Web source';

  const curated = lookup(url);
  if (curated) return curated.kind;

  if (host.endsWith('.gov') || host.endsWith('.gov.uk')) return 'Government';
  if (host.endsWith('.int')) return 'Intergovernmental';
  if (host.endsWith('.edu') || host.endsWith('.ac.uk')) return 'Academic';
  if (host.endsWith('.org')) return 'Organization';
  return 'Web source';
}
