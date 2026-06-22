# better_perplexity

A trust-weighted, contradiction-aware web research assistant. You ask a research
question; the system searches the web, scores each source for credibility,
surfaces where sources agree and disagree, and returns an answer where every
claim is cited and auditable. The difference from a plain search chatbot is that
you can see *why* a source was trusted or downranked.

> Status: early development. See the [issues](../../issues) and
> [milestones](../../milestones) for the roadmap.

## Why

Naive search trusts its sources blindly. This adds a layer that makes source
credibility and cross-source agreement explicit, so a research or due-diligence
user reaches a trustworthy, source-grounded answer faster than vetting sources by
hand.

## Stack

- Next.js (App Router) + React + Tailwind, TypeScript strict, end to end
- Orchestration via Next.js Route Handlers (one app, one container)
- LLM behind a provider abstraction (Gemini for the current build; swappable)
- Embeddings for corroboration and near-duplicate detection
- Search: Tavily + Exa, signals fused
- Deploy: Cloud Run (containerized Next standalone output)
- CI: GitHub Actions (lint + typecheck + test)

## Pipeline

1. Query intake and normalization (optional sub-query planning)
2. Retrieve from Tavily + Exa in parallel; dedupe by URL and by embedding
3. Fetch and parse page text for the top sources, with snippet fallback
4. Extract atomic claims per source as schema-validated JSON
5. Trust scoring: domain prior + cross-source corroboration + recency, then rerank
6. Synthesis: compose the answer from trust-weighted sources, every claim cited
7. Verification: check each answer sentence against a high-trust source; flag the rest
8. (Stretch) Contradiction graph: link claims by entity, show consensus vs disputed
9. Trace: log sources, scores, model calls, tokens, latency, and cost per query

## Development

```bash
pnpm install
pnpm dev         # local dev
pnpm test        # unit tests
pnpm lint        # eslint + typecheck
pnpm build       # next build (standalone)
pnpm eval        # run the eval harness, print metrics
```

Copy `.env.example` to `.env` and fill in your API keys before running the
search pipeline.

## License

[MIT](LICENSE)
