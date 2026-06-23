// Demo-grade numeric extractors for the corroboration spectrum (#14) and the
// contradiction graph (#18). extractMetricValue is unit-unaware (kept for the
// offline eval, whose dataset is curated). extractMetric is unit-aware (#46): it
// only returns a number paired with a recognized comparable unit, so the live
// spectrum and graph compare like with like (TWh vs TWh) instead of lumping a
// percentage, a follower count, or a URL id into one axis. Claim-level extraction
// (#11) would be more precise still; this stays cheap (no LLM calls).

const NUMBER_RE = /(\d[\d,]*(?:\.\d+)?)\s*(billion|million|thousand|trillion)?/gi;

const MAGNITUDE: Record<string, number> = {
  thousand: 1e3,
  million: 1e6,
  billion: 1e9,
  trillion: 1e12,
};

export function extractMetricValue(text: string): number | null {
  let best: number | null = null;
  for (const match of text.matchAll(NUMBER_RE)) {
    const base = Number.parseFloat(match[1].replace(/,/g, ''));
    if (Number.isNaN(base)) continue;
    const word = match[2]?.toLowerCase();
    // Skip plausible calendar years when there is no magnitude word.
    if (!word && Number.isInteger(base) && base >= 1900 && base <= 2100) continue;
    const value = word ? base * MAGNITUDE[word] : base;
    if (best === null || value > best) best = value;
  }
  return best;
}

export interface Metric {
  value: number;
  unit: string;
}

// Only numbers carrying one of these comparable units are treated as metrics.
const RECOGNIZED_UNITS: Record<string, string> = {
  twh: 'TWh',
  gwh: 'GWh',
  pwh: 'PWh',
  mwh: 'MWh',
  kwh: 'kWh',
  percent: '%',
  pct: '%',
  '%': '%',
  usd: 'USD',
  eur: 'EUR',
  gbp: 'GBP',
  dollars: 'USD',
  dollar: 'USD',
  cm: 'cm',
  km: 'km',
  tonnes: 't',
  tonne: 't',
  tons: 't',
  ton: 't',
  gt: 'Gt',
  mt: 'Mt',
  kg: 'kg',
};

const METRIC_RE = /(\d[\d,]*(?:\.\d+)?)\s*(billion|million|thousand|trillion)?\s*([a-zA-Z%]+)?/gi;

/** Returns the source's salient number paired with a recognized comparable unit,
 *  or null if no number carries such a unit. URL/domain numbers are stripped so
 *  ids and follower counts do not masquerade as metrics. */
export function extractMetric(text: string): Metric | null {
  const cleaned = text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\b[\w-]+\.(?:com|org|net|io|gov|edu|ai)\b\S*/gi, ' ');

  let best: Metric | null = null;
  for (const match of cleaned.matchAll(METRIC_RE)) {
    const base = Number.parseFloat(match[1].replace(/,/g, ''));
    if (Number.isNaN(base)) continue;
    const magnitude = match[2]?.toLowerCase();
    const rawUnit = (match[3]?.toLowerCase() ?? '').replace(/[.,;:]+$/, '');
    const unit = RECOGNIZED_UNITS[rawUnit];
    if (!unit) continue;
    const value = magnitude ? base * MAGNITUDE[magnitude] : base;
    if (best === null || value > best.value) best = { value, unit };
  }
  return best;
}

/** The most common recognized unit across a set of texts (its mode), or null
 *  when fewer than two texts share a unit. The shared axis for the spectrum. */
export function dominantUnit(texts: string[]): string | null {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const metric = extractMetric(text);
    if (metric) counts.set(metric.unit, (counts.get(metric.unit) ?? 0) + 1);
  }
  let bestUnit: string | null = null;
  let bestCount = 1;
  for (const [unit, count] of counts) {
    if (count > bestCount || (count === bestCount && bestUnit === null)) {
      if (count >= 2) {
        bestUnit = unit;
        bestCount = count;
      }
    }
  }
  return bestUnit;
}
