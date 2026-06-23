# Locked demo queries (#25)

Three queries, each chosen to show a different facet of the trust and
verification layers at its best. They are surfaced as the example chips on the
empty-state hero.

## Query 1 (lead) — corroboration cluster + scope trap

> global data center electricity demand 2030 forecast TWh

- A tight corroboration cluster (~945 to 980 TWh) forms across independent
  high-trust domains (IEA, EIA, Reuters), so the cluster ranks at the top with a
  visible "corroborated by N independent domains" reason.
- Real outliers exist, and there is a scope trap: US-only figures presented
  against a global question. Verification flags the scope mismatch in a banner.
- The corroboration spectrum makes the cluster-vs-outlier spread spatial.

## Query 2 — trust scoring downranks junk

> Does vitamin C prevent the common cold?

- The web is full of supplement and SEO pages asserting strong prevention, while
  authoritative sources (Cochrane, NIH) report a modest-to-no preventive effect.
- This shows the differentiator directly: low domain priors and a lack of
  cross-source corroboration push the content-farm pages down, and the
  high-trust sources rise, each with a one-line reason.

## Query 3 (optional) — contradiction across reputable sources

> How many trees are there on Earth?

- Reputable sources genuinely disagree: the 2015 Nature study estimates ~3.04
  trillion, while earlier peer-reviewed work estimated far fewer (~400 billion).
- The corroboration spectrum plots the spread; verification surfaces that the
  figure is disputed rather than settled. (The full consensus-vs-disputed graph
  view is #18/#19, a stretch goal not built.)

## Verification status

The query _choices_ are locked here. The acceptance items that require the live,
deployed system ("downranks a weak source on the live URL", "runs cleanly on the
deployed URL") depend on Cloud Run deploy (#22) and provider API keys, which are
out of scope for this pass. Offline, the trust ranking and contradiction
behaviour for the lead-query pattern are exercised by the eval harness (#17).
