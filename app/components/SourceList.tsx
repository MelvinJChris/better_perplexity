import type { ScoredSource } from '@/lib/types';
import { CorroborationSpectrum } from './CorroborationSpectrum';
import { SourceCard } from './SourceCard';

// Sources arrive already reranked by trust (#13), so render order conveys rank.
export function SourceList({ sources }: { sources: ScoredSource[] }) {
  return (
    <div className="space-y-4">
      <CorroborationSpectrum sources={sources} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {sources.map((source, i) => (
          <SourceCard key={source.url} index={i + 1} source={source} />
        ))}
      </ul>
    </div>
  );
}
