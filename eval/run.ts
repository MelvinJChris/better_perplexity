import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contradictionDetected, corroborationProxy, precisionAtK } from '@/lib/eval';
import { scoreTrust } from '@/lib/pipeline/scoreTrust';
import { estimateCostUsd, PROJECTED_RATES } from '@/lib/trace/cost';
import type { Source } from '@/lib/types';

// Offline eval harness (#17). Runs against a hand-labeled dataset with cached
// sources, so it burns no search/LLM quota and needs no keys. Trust-rank quality
// and contradiction recall are computed for real against the live scoreTrust;
// faithfulness and latency are live-only and labelled as such. Cost is shown as
// the free-tier measured value plus a paid-rate projection.

interface EvalEntry {
  id: string;
  query: string;
  expectedTopDomains?: string[];
  contradiction?: { description: string; outlierUrl: string };
  sources: Source[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(readFileSync(path.join(here, 'dataset.json'), 'utf8')) as EvalEntry[];

let trustSum = 0;
let trustCount = 0;
let contradictionHits = 0;
let contradictionCount = 0;
const rows: string[] = [];

for (const entry of dataset) {
  const corroboratingDomains = corroborationProxy(entry.sources);
  const scored = scoreTrust(entry.sources, { corroboratingDomains });

  let trustCell = '   -  ';
  if (entry.expectedTopDomains?.length) {
    const precision = precisionAtK(scored, entry.expectedTopDomains);
    trustSum += precision;
    trustCount += 1;
    trustCell = precision.toFixed(2).padStart(5);
  }

  let contradictionCell = ' -  ';
  if (entry.contradiction) {
    contradictionCount += 1;
    const detected = contradictionDetected(scored, entry.contradiction.outlierUrl);
    if (detected) contradictionHits += 1;
    contradictionCell = detected ? 'yes ' : 'MISS';
  }

  rows.push(`  ${entry.id.padEnd(26)}  trust@k ${trustCell}   contradiction ${contradictionCell}`);
}

const trustRank = trustCount > 0 ? trustSum / trustCount : 0;
const contradictionRecall = contradictionCount > 0 ? contradictionHits / contradictionCount : 0;

// Representative profile (one query) for the production cost projection.
const PROFILE = { inputTokens: 3000, outputTokens: 800, searchCalls: 2 };
const projectedCost = estimateCostUsd(
  PROFILE.inputTokens,
  PROFILE.outputTokens,
  PROFILE.searchCalls,
  PROJECTED_RATES,
);

console.log('\nbetter_perplexity eval  (offline: cached sources, no search/LLM quota used)\n');
console.log(rows.join('\n'));
console.log('\nMetrics');
console.log(
  '  1. Faithfulness         live-only — every answer sentence is verified (run with keys)',
);
console.log(
  `  2. Trust-rank quality   ${trustRank.toFixed(2)}  (mean precision@k over ${trustCount} labeled queries)`,
);
console.log(
  `  3. Contradiction recall ${contradictionRecall.toFixed(2)}  (${contradictionHits}/${contradictionCount} labeled outliers flagged)`,
);
console.log('  4. Latency p50/p95      live-only — measured end to end on a live run');
console.log(
  `  5. Cost per query       $0.0000 measured (free tier); ~$${projectedCost.toFixed(4)} projected at paid rates`,
);
console.log('');
