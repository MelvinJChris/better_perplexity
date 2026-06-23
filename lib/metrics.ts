// Demo-grade numeric extractor for the corroboration spectrum (#14). It pulls a
// single comparable magnitude out of a source's text so values can be plotted on
// a shared axis: agreeing sources clump, outliers sit apart. This is a heuristic
// (claim-level extraction in #11/#18 would be more precise); it deliberately
// skips bare 4-digit years so "945 TWh by 2030" reads as 945, not 2030.

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
