import type { Source } from '@/lib/types';
import { SourceCard } from './SourceCard';

export function SourceList({ sources }: { sources: Source[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {sources.map((source, i) => (
        <SourceCard key={source.url} index={i + 1} source={source} />
      ))}
    </ul>
  );
}
