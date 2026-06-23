import { z } from 'zod';

// Secrets come only from env vars. Validation is lazy so the app can build and
// the stubbed pipeline can typecheck before any keys are present (see #5).

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  TAVILY_API_KEY: z.string().min(1),
  EXA_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
