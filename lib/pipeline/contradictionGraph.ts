import { cosineSimilarity } from '@/lib/pipeline/dedupe';

// (Stretch, #18/#20) An in-memory contradiction graph. Claims about the same
// entity are linked by embedding similarity; an edge is a disagreement when the
// linked claims carry diverging numbers, otherwise agreement. Pure given
// embeddings, so it is unit-tested. In-memory only: a per-query graph needs no
// external store, and Neo4j would add operational weight without demo value
// (#20), so it is intentionally skipped.

export interface GraphClaim {
  id: string;
  sourceUrl: string;
  text: string;
  /** Comparable numeric value, when the claim states one. */
  value: number | null;
}

export interface GraphEdge {
  a: string;
  b: string;
  relation: 'agree' | 'disagree';
}

export interface ContradictionGraph {
  claims: GraphClaim[];
  edges: GraphEdge[];
}

export interface GraphOptions {
  /** Min cosine similarity to treat two claims as about the same entity. */
  linkThreshold?: number;
  /** Fractional gap in values above which linked claims disagree. */
  valueTolerance?: number;
}

const LINK_THRESHOLD = 0.6;
const VALUE_TOLERANCE = 0.1;

export function buildContradictionGraph(
  claims: GraphClaim[],
  embeddings: number[][],
  opts?: GraphOptions,
): ContradictionGraph {
  const link = opts?.linkThreshold ?? LINK_THRESHOLD;
  const tolerance = opts?.valueTolerance ?? VALUE_TOLERANCE;
  const edges: GraphEdge[] = [];

  for (let i = 0; i < claims.length; i += 1) {
    for (let j = i + 1; j < claims.length; j += 1) {
      if (cosineSimilarity(embeddings[i] ?? [], embeddings[j] ?? []) < link) continue;
      const a = claims[i].value;
      const b = claims[j].value;
      let relation: GraphEdge['relation'] = 'agree';
      if (a !== null && b !== null) {
        const scale = Math.max(Math.abs(a), Math.abs(b)) || 1;
        if (Math.abs(a - b) > tolerance * scale) relation = 'disagree';
      }
      edges.push({ a: claims[i].id, b: claims[j].id, relation });
    }
  }

  return { claims, edges };
}

/** Groups claims into connected clusters that contain at least one disagreement.
 *  Each returned group is a disputed set of two or more claims. */
export function summarizeContradictions(graph: ContradictionGraph): GraphClaim[][] {
  const parent = new Map<string, string>();
  for (const c of graph.claims) parent.set(c.id, c.id);

  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    return root;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  for (const e of graph.edges) union(e.a, e.b);

  const disputedRoots = new Set<string>();
  for (const e of graph.edges) if (e.relation === 'disagree') disputedRoots.add(find(e.a));

  const groups = new Map<string, GraphClaim[]>();
  for (const c of graph.claims) {
    const root = find(c.id);
    if (!disputedRoots.has(root)) continue;
    const group = groups.get(root) ?? [];
    group.push(c);
    groups.set(root, group);
  }

  return [...groups.values()].filter((g) => g.length >= 2);
}
