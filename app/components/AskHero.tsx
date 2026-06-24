'use client';

import { QueryForm } from './QueryForm';

// The locked clinical demo set (see eval/DEMO_QUERIES.md): each shows the trust
// layer at its best, the evidence hierarchy downranking supplement/SEO pages,
// and genuine disagreement across reputable studies.
const EXAMPLES = [
  'Does vitamin D reduce the risk of respiratory infections?',
  'Does vitamin C prevent the common cold?',
  'Is intermittent fasting effective for type 2 diabetes?',
];

export function AskHero({ onSubmit }: { onSubmit: (query: string) => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">better_perplexity</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Clinical answers you can trust.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Ask a clinical question. Every source is scored on the evidence hierarchy, from systematic
        reviews down to wellness blogs, cross-study agreement is made explicit, and every claim in
        the answer is cited.
      </p>

      <div className="mt-8">
        <QueryForm onSubmit={onSubmit} variant="hero" autoFocus />
      </div>

      <div className="mt-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Try</p>
        <ul className="mt-3 space-y-2">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => onSubmit(example)}
                className="w-full rounded-card border border-hairline bg-surface px-4 py-3 text-left text-sm text-ink shadow-card transition-colors hover:border-accent hover:text-accent"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
