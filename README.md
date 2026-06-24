# better_perplexity

A trust-weighted, contradiction-aware **clinical** research assistant. You ask a
clinical question; the system searches the web, scores each source on an
evidence-based credibility hierarchy, surfaces where studies agree and disagree,
and returns an answer where every claim is cited and auditable. The difference
from a plain search chatbot is that you can see _why_ a source was trusted or
downranked.

**Live:** https://better-perplexity-949650831527.us-central1.run.app

## Why this, and why a vertical

Naive RAG trusts its sources blindly. Making credibility and cross-source
agreement explicit is the wedge; committing to **healthcare** is what turns
copyable features into a defensible product. The moat is not the scoring code (a
competitor could copy that in a sprint), it is the curated, expert-maintainable
**clinical credibility model**: which journals, guideline bodies, and registries
to trust, and where a claim sits on the evidence pyramid (systematic reviews
above RCTs, above observational studies, above preclinical work and opinion).
Generic answer engines optimize for fast consumer answers; this optimizes for the
job where being wrong is costly and you must defend every claim, the clinician or
researcher vetting evidence.

## Quickstart

Requires Node 22 and pnpm.

```bash
pnpm install
pnpm test          # 84 deterministic unit tests
pnpm lint          # eslint
pnpm typecheck     # tsc --noEmit
pnpm eval          # eval harness, prints the five metrics (offline, no keys)
pnpm build         # next build (standalone output)
```

`pnpm eval` runs against a cached, hand-labeled dataset, so it needs no API keys
and burns no search quota. Everything above runs with no secrets.

To run the live app you need three free-tier keys. Copy the template and fill it
in:

```bash
cp .env.example .env   # GEMINI_API_KEY, TAVILY_API_KEY, EXA_API_KEY
pnpm dev               # http://localhost:3000
```

Without keys the UI still renders; the pipeline returns a clear error state.

## Architecture

One Next.js app, one Cloud Run request, streamed to the client. The pipeline
(`lib/pipeline`) is:

1. **Intake**: validate the query (zod).
2. **Retrieve**: Tavily (keyword) and Exa (semantic) in parallel, fused into one
   `Source[]`, deduped by URL then by embedding near-duplicate so syndicated
   copies are not double-counted (`lib/providers/search.ts`).
3. **Trust score**: each source gets a 0..100 score combining the clinical domain
   prior (`domainPrior.ts`: Cochrane/NEJM/CDC/PubMed high, wellness/supplement SEO
   low), corroboration across independent domains, recency, and an evidence-level
   signal (`evidence.ts`: systematic reviews rank above RCTs, then observational,
   then preclinical), then reranks with a one-line reason (`scoreTrust.ts`,
   `corroboration.ts`).
4. **Synthesize**: Gemini Flash composes the answer from the trust-ranked
   sources, streamed token by token, every claim carrying a `[n]` citation.
5. **Verify**: each answer sentence is checked for support from a high-trust
   source; unsupported sentences are flagged (never dropped) and scope
   mismatches (e.g. a US figure for a global question) are called out.
6. **Trace**: sources, scores, model, tokens, and latency are logged as one
   structured line and streamed to the client.

The response is NDJSON: a `sources` event, then `token` events, then a
`verification` event, then a `trace`. Errors are a terminal `error` event, so the
stream always closes cleanly. The handler is stateless and safe to retry.

### Two decisions worth pointing at

- **Provider abstraction.** Every model call goes through one `LlmProvider`
  interface (`complete`, `completeStream`, `embed`) and every search call through
  one `SearchProvider`. Gemini and Tavily/Exa sit behind them for this build;
  swapping to Claude, GPT, or another search backend is a config change, not a
  rewrite. All external calls run through a rate-limit queue with bounded
  concurrency, RPM spacing, and full-jitter exponential backoff, because the free
  tiers 429 under bursts.
- **The trust layer is the product.** Domain prior is a small curated table plus
  TLD heuristics; corroboration counts how many _independent_ domains agree by
  embedding similarity (a site cannot corroborate itself, and syndication does not
  inflate it); the corroboration spectrum plots comparable numbers on one axis so
  the agreeing cluster clumps and outliers sit apart. Every model output is
  validated through a zod schema; raw model text is never trusted.

## Measured metrics

From `pnpm eval` over a 15-query hand-labeled set (offline, deterministic):

| Metric               | Value                 | How                                                      |
| -------------------- | --------------------- | -------------------------------------------------------- |
| Trust-rank quality   | 1.00 mean precision@k | expected high-trust domains rank top, 15 labeled queries |
| Contradiction recall | 1.00 (4/4)            | labeled supplement/marketing outliers flagged            |
| Cost per query       | $0.00 free tier       | from real token + search counts; ~$0.017 at paid rates   |
| Faithfulness         | live-only             | every answer sentence verified on a keyed run            |
| Latency p50/p95      | live-only             | measured end to end on a keyed run                       |

Faithfulness and latency need live LLM and search calls; the harness measures
them on a keyed run and labels them live-only otherwise. Trust-rank and
contradiction are computed against the real `scoreTrust`.

## Project structure

```
app/                  UI (chat) + /api/search route handler (streamed NDJSON)
  components/         hero, source cards, trust meter, corroboration spectrum, verification
lib/
  providers/          llmProvider (Gemini), searchProvider (Tavily + Exa), rate-limit queue
  pipeline/           dedupe, corroboration, scoreTrust, synthesize, verify, extractClaims, runSearch
  trace/              per-query trace and cost model
  client/             NDJSON stream parser
eval/                 hand-labeled dataset, harness (pnpm eval), demo queries
tests/                deterministic unit tests
Dockerfile            Next standalone image for Cloud Run
```

## Deployment

The container is a multi-stage build of the Next standalone output (small image,
non-root, runtime is `node server.js`):

```bash
docker build -t better-perplexity .
docker run -p 8080:8080 --env-file .env better-perplexity   # http://localhost:8080

# Cloud Run (tracks main in production):
gcloud run deploy better-perplexity --source . \
  --region <region> --allow-unauthenticated \
  --timeout 120 --concurrency 4 --min-instances 0 --max-instances 5 \
  --set-secrets GEMINI_API_KEY=...,TAVILY_API_KEY=...,EXA_API_KEY=...
```

The Cloud Run settings are deliberate: the request **timeout** sits above the
loop p95, **concurrency** is lowered because each request is LLM-heavy,
**min-instances 0** keeps idle cost at zero (a cold start is acceptable for an
interactive demo), and **max-instances** is capped to bound spend. State lives in
the request, never in instance memory, so requests are idempotent and safe to
retry. Live at https://better-perplexity-949650831527.us-central1.run.app
(min-instances 0, so the first request after idle cold-starts in ~1.5s).

## Trade-offs and what was cut

- **No async/background infrastructure** (Cloud Tasks, Pub/Sub, workers). It is
  the right production path for long jobs, but a sub-minute query does not need
  it; building it would have been gold-plating.
- **No auth, accounts, persistence, or mobile.** Out of scope by design.
- **Live trust ranking corroborates over source embeddings, not per-source claim
  extraction.** `extractClaims` exists and is tested (it feeds the contradiction
  graph), but running an LLM extraction per source is the single biggest cost and
  latency lever, so the core path avoids it: one batched embedding call gives the
  corroboration signal cheaply. That is the one lever that moves cost per query.
- **Contradiction graph (consensus vs disputed view) is a stretch and not built.**
  It was scoped to be the first thing cut if behind; verification + the
  corroboration spectrum already surface disagreement.

## Testing

Strict TDD for deterministic code (trust math, dedupe and corroboration
thresholds, the rate-limit queue and backoff, client and model-output parsing,
schema validation). LLM-dependent behavior is measured by the eval harness, not
brittle assertions: a hand-labeled set scored for trust ranking and contradiction
recall. CI (GitHub Actions) runs lint, typecheck, and tests on every push.

## License

[MIT](LICENSE)
