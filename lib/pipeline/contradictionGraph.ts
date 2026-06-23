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
  /** Unit of `value` (e.g. TWh, %); claims only disagree within the same unit. */
  unit?: string;
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
      // Only compare numbers measured in the same unit, so a percentage or a
      // follower count can never "disagree" with a TWh figure (#46).
      const sameUnit = !!claims[i].unit && claims[i].unit === claims[j].unit;
      let relation: GraphEdge['relation'] = 'agree';
      if (sameUnit && a !== null && b !== null) {
        const scale = Math.max(Math.abs(a), Math.abs(b)) || 1;
        if (Math.abs(a - b) > tolerance * scale) relation = 'disagree';
      }
      edges.push({ a: claims[i].id, b: claims[j].id, relation });
    }
  }

  return { claims, edges };
}

/** Groups the claims that actually participate in a disagreement (an endpoint of
 *  a disagree edge), connected through those disagreements. Agree-only neighbours
 *  in the same embedding cluster are excluded, so a disputed group lists only the
 *  genuinely conflicting claims (#46). Each group has two or more claims. */
export function summarizeContradictions(graph: ContradictionGraph): GraphClaim[][] {
  const disputed = new Set<string>();
  for (const e of graph.edges) {
    if (e.relation === 'disagree') {
      disputed.add(e.a);
      disputed.add(e.b);
    }
  }
  if (disputed.size === 0) return [];

  const parent = new Map<string, string>();
  for (const id of disputed) parent.set(id, id);
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    return root;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  for (const e of graph.edges) {
    if (e.relation === 'disagree') union(e.a, e.b);
  }

  const groups = new Map<string, GraphClaim[]>();
  for (const c of graph.claims) {
    if (!disputed.has(c.id)) continue;
    const root = find(c.id);
    const group = groups.get(root) ?? [];
    group.push(c);
    groups.set(root, group);
  }

  return [...groups.values()].filter((g) => g.length >= 2);
}
