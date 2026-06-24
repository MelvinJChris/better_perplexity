# Locked demo queries (#55)

The vertical is clinical evidence. Three queries, each chosen to show a different
facet of the trust layer at its best. They are the example chips on the hero.

## Query 1 (lead) — evidence hierarchy + genuine nuance

> Does vitamin D reduce the risk of respiratory infections?

- High-trust evidence (Cochrane and BMJ meta-analyses) reports a modest
  protective effect, largest in deficient people, while supplement and wellness
  pages overstate it. The credibility model and the evidence-level signal put the
  systematic reviews on top; the answer reflects the nuance rather than the hype.
- Verification flags any sentence the high-trust sources do not support.

## Query 2 — trust downranks the junk

> Does vitamin C prevent the common cold?

- The web is full of supplement/SEO pages claiming strong prevention; the
  evidence (Cochrane) shows little preventive effect for most people. This shows
  the differentiator directly: low domain priors and no corroboration push the
  content-farm pages down, and the systematic reviews rise, each with a reason.

## Query 3 — disagreement across reputable sources

> Is intermittent fasting effective for type 2 diabetes?

- Reputable sources genuinely differ (short-term glycemic benefit in some trials
  vs. guidelines urging caution). The corroboration view and verification surface
  that this is contested rather than settled.

## Verification status

The query choices are locked here. The acceptance items that require the live,
deployed system ("downranks a weak source on the live URL", "runs cleanly on the
deployed URL") depend on Cloud Run deploy (#22) and provider API keys. Offline,
the clinical credibility ranking and contradiction behaviour are exercised by the
eval harness (#17, #56).
