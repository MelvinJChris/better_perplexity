// Cost per query from real token and search-call counts (#17). The demo runs on
// free tiers (zero marginal cost), so the value of this is the methodology and a
// production projection: swap in paid rates and the same counts yield a real
// dollar figure. Rates are approximate and configurable; confirm before quoting.

export interface CostRates {
  inputPerMTok: number;
  outputPerMTok: number;
  perSearchCall: number;
}

/** Free-tier demo: no marginal cost. */
export const FREE_TIER_RATES: CostRates = {
  inputPerMTok: 0,
  outputPerMTok: 0,
  perSearchCall: 0,
};

/** Approximate paid rates for a production cost projection (USD). Configurable. */
export const PROJECTED_RATES: CostRates = {
  inputPerMTok: 0.1,
  outputPerMTok: 0.4,
  perSearchCall: 0.008,
};

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  searchCalls: number,
  rates: CostRates = FREE_TIER_RATES,
): number {
  return (
    (inputTokens / 1_000_000) * rates.inputPerMTok +
    (outputTokens / 1_000_000) * rates.outputPerMTok +
    searchCalls * rates.perSearchCall
  );
}
