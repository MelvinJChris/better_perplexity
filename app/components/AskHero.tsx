'use client';

import { QueryForm } from './QueryForm';

// The locked lead query (CLAUDE.md demo #1) leads the examples.
const EXAMPLES = [
  'global data center electricity demand 2030 forecast TWh',
  'Does creatine supplementation improve cognitive performance?',
  'What is the scientific consensus on microplastics and human health?',
];

export function AskHero({ onSubmit }: { onSubmit: (query: string) => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">better_perplexity</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Research answers you can audit.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Ask a research question. Every source is scored for credibility, cross-source agreement is
        made explicit, and every claim in the answer is cited.
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
                className="w-full rounded-card border border-hairline bg-surface px-4 py-3 text-left text-sm text-ink shadow-card transition-colors hover:border-accent"
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
