const PIPELINE = [
  'Retrieve from multiple search providers, deduped',
  'Extract atomic, citable claims per source',
  'Score each source for trust, then rerank',
  'Synthesize a cited answer from trust-weighted sources',
  'Verify every sentence against a high-trust source',
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">better_perplexity</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Research answers you can audit.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Ask a research question. Every source is scored for credibility, cross-source agreement is
        made explicit, and every claim in the answer is cited and verifiable. You can see why a
        source was trusted or downranked.
      </p>

      <ol className="mt-8 space-y-2">
        {PIPELINE.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm text-ink">
            <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="mt-10 font-mono text-xs text-muted">
        Scaffold only. The chat UI arrives in issue #10.
      </p>
    </main>
  );
}
