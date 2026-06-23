import { z } from 'zod';

// Interface contracts for the pipeline. All LLM output is validated through
// these zod schemas before it is trusted (see CLAUDE.md conventions).

export const sourceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  text: z.string().optional(),
  rawRelevance: z.number(),
  /** ISO date the source was published, when the provider reports it (recency). */
  publishedAt: z.string().optional(),
});
export type Source = z.infer<typeof sourceSchema>;

export const claimSchema = z.object({
  sourceUrl: z.string().url(),
  text: z.string().min(1),
});
export type Claim = z.infer<typeof claimSchema>;
export const claimsSchema = z.array(claimSchema);

export const scoredSourceSchema = sourceSchema.extend({
  trustScore: z.number().min(0).max(100),
  trustReason: z.string(),
  /** Number of independent domains that corroborate this source (#12). */
  corroborations: z.number().int().min(0),
});
export type ScoredSource = z.infer<typeof scoredSourceSchema>;

export const citationSchema = z.object({
  marker: z.number().int().positive(),
  sourceUrl: z.string().url(),
  quote: z.string().optional(),
});
export type Citation = z.infer<typeof citationSchema>;

export const verifiedAnswerSchema = z.object({
  text: z.string(),
  citations: z.array(citationSchema),
  unsupported: z.array(z.string()),
  /** Set when the answer leans on out-of-scope figures (e.g. US vs global). */
  scopeMismatch: z.string().optional(),
});
export type VerifiedAnswer = z.infer<typeof verifiedAnswerSchema>;
