# Design system (issue #27)

Perplexity-familiar, trust-native. Answer-first conversational research, but every
source carries a visible credibility verdict and every claim is verifiable inline.
The single source of truth for tokens is the Tailwind theme (`tailwind.config.ts`);
this file documents the intent so #10, #14, #16, and #19 build without re-deciding.

## Tokens (Tailwind theme)

Color (`theme.extend.colors`):

| Token        | Hex       | Use                                   |
| ------------ | --------- | ------------------------------------- |
| `ink`        | `#1A1C1F` | Primary text                          |
| `muted`      | `#5B6472` | Secondary text and labels             |
| `paper`      | `#FBFBFA` | Page background                       |
| `surface`    | `#FFFFFF` | Cards and raised surfaces             |
| `hairline`   | `#E6E8EB` | Borders                               |
| `accent`     | `#0E7490` | Links, citations, focus               |
| `trust.high` | `#0F766E` | High credibility                      |
| `trust.mid`  | `#9AA0A6` | Mid credibility                       |
| `trust.low`  | `#B45309` | Low credibility (downranked, not bad) |

The trust ramp is **sequential, never binary red/green**. Trust is always encoded
by more than color: the score number (mono) + a small bar/fill + a label. Color
alone is never the signal (accessibility floor).

Other tokens: `rounded-card` (12px), `shadow-card` (one soft low shadow),
`shadow-focus`, `animate-reveal` (a 0.25s results reveal, suppressed under
`prefers-reduced-motion`).

## Typography

The typographic signature is the sans/mono split:

- **Sans (Hanken Grotesk)** — UI, prose, headings. A humanist sans with more
  personality than plain Inter. Loaded via `next/font`, exposed as `--font-sans`
  → Tailwind `font-sans`.
- **Mono (IBM Plex Mono)** — reserved for measured, auditable data: trust scores,
  numeric values, domains, dates. Exposed as `--font-mono` → `font-mono`. Mono is
  never used for prose; it is how evidence reads apart from narrative.

Type scale uses Tailwind defaults with intentional weights (headings
`font-semibold tracking-tight`, body `leading-relaxed`).

## Component kit

- **Ask box** — prominent empty-state hero: a one-line POV and 2 to 3 example
  queries (including the locked lead query). Implemented in `app/components`.
- **Answer block** — streamed markdown with inline numbered `[n]` citations.
  Styled citation chips with source hover-highlight land with the trust UI
  (#14/#16); #10 ships readable markdown + numbered sources.
- **Source card** — monogram + domain (mono), title (link), snippet. Trust score
  (mono) + one-line reason and the corroboration badge are added in #14.
- **Scope/verification callout** — inline banner for unsupported claims (#16).
- **Corroboration spectrum** — the signature element: numeric claims plotted on a
  shared axis so agreement clumps and outliers separate (#14). Degrades when a
  query has no comparable number.
- **Consensus vs disputed view** — stretch (#19).

## Motion and accessibility

- Restrained motion only: streaming text, a subtle reveal, citation hover. No
  decorative motion. `prefers-reduced-motion` is respected globally.
- Visible keyboard focus (`:focus-visible` ring), AA contrast, color never the
  sole signal. Desktop-first; remains usable at a narrow width.
