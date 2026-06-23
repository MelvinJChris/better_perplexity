export type TrustTier = 'high' | 'mid' | 'low';

/** Buckets a 0..100 trust score into a tier for the UI ramp (issue #27). */
export function trustTier(score: number): TrustTier {
  if (score >= 75) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}
