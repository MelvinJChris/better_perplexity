import { describe, expect, it } from 'vitest';
import {
  buildContradictionGraph,
  summarizeContradictions,
  type GraphClaim,
} from '@/lib/pipeline/contradictionGraph';

const claim = (id: string, value: number | null, unit = 'TWh'): GraphClaim => ({
  id,
  sourceUrl: `https://${id}.example`,
  text: `claim ${id}`,
  value,
  unit: value === null ? undefined : unit,
});

describe('buildContradictionGraph', () => {
  it('links same-entity claims and marks diverging same-unit numbers as disagreement', () => {
    const claims = [claim('a', 945), claim('b', 960), claim('c', 600)];
    // a, b, c are all about the same entity (high similarity).
    const embeddings = [
      [1, 0],
      [1, 0],
      [1, 0],
    ];
    const graph = buildContradictionGraph(claims, embeddings, { valueTolerance: 0.1 });
    const rel = (x: string, y: string) =>
      graph.edges.find((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x))?.relation;
    expect(rel('a', 'b')).toBe('agree'); // 945 vs 960: within tolerance
    expect(rel('a', 'c')).toBe('disagree'); // 945 vs 600: diverging
    expect(rel('b', 'c')).toBe('disagree');
  });

  it('does not link claims about different entities', () => {
    const claims = [claim('a', 945), claim('b', 1)];
    const embeddings = [
      [1, 0],
      [0, 1],
    ];
    expect(buildContradictionGraph(claims, embeddings).edges).toHaveLength(0);
  });

  it('never disagrees across different units (#46)', () => {
    // Linked by embedding, but a TWh figure and a percentage are not comparable.
    const claims = [claim('a', 945, 'TWh'), claim('b', 17, '%')];
    const embeddings = [
      [1, 0],
      [1, 0],
    ];
    const graph = buildContradictionGraph(claims, embeddings);
    expect(graph.edges[0].relation).toBe('agree');
  });
});

describe('summarizeContradictions', () => {
  it('returns the disputed cluster of claims', () => {
    const claims = [claim('a', 945), claim('b', 960), claim('c', 600), claim('d', null)];
    const embeddings = [
      [1, 0],
      [1, 0],
      [1, 0],
      [0, 1],
    ];
    const graph = buildContradictionGraph(claims, embeddings);
    const disputed = summarizeContradictions(graph);
    expect(disputed).toHaveLength(1);
    expect(disputed[0].map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns nothing when all linked claims agree', () => {
    const claims = [claim('a', 945), claim('b', 950)];
    const embeddings = [
      [1, 0],
      [1, 0],
    ];
    expect(summarizeContradictions(buildContradictionGraph(claims, embeddings))).toEqual([]);
  });
});
