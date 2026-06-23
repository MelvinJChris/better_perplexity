import type { ContradictionGraphData } from '@/lib/pipeline/runSearch';
import { trustTier, type TrustTier } from '@/lib/trust';

// The knowledge graph as a node-link visual (#63): each source is a node on a
// ring, colored by trust tier and labeled by its [n] from the cards. Edges link
// sources that speak to the same point, agreement faint, disagreement in the
// outlier color. Circular layout keeps it deterministic with no physics/deps.

const COLOR: Record<TrustTier, string> = {
  high: '#0F766E',
  mid: '#CA8A04',
  low: '#C2410C',
};

export function ContradictionGraphView({ graph }: { graph: ContradictionGraphData }) {
  const connected = new Set(graph.edges.flatMap((e) => [e.a, e.b]));
  const nodes = graph.nodes.filter((n) => connected.has(n.id));
  if (nodes.length < 2 || graph.edges.length === 0) return null;

  const size = 340;
  const center = size / 2;
  const radius = size / 2 - 46;
  const pos = new Map(
    nodes.map((n, i) => {
      const angle = -Math.PI / 2 + (i / nodes.length) * 2 * Math.PI;
      return [n.id, { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }];
    }),
  );

  const agree = graph.edges.filter((e) => e.relation === 'agree');
  const disagree = graph.edges.filter((e) => e.relation === 'disagree');

  const line = (
    e: { a: string; b: string },
    props: Record<string, string | number>,
    key: string,
  ) => {
    const p = pos.get(e.a);
    const q = pos.get(e.b);
    if (!p || !q) return null;
    return <line key={key} x1={p.x} y1={p.y} x2={q.x} y2={q.y} {...props} />;
  };

  return (
    <figure className="animate-reveal rounded-card border border-hairline bg-surface p-4 shadow-card">
      <figcaption className="font-mono text-xs uppercase tracking-widest text-muted">
        Knowledge graph
      </figcaption>
      <p className="mt-1 text-xs text-muted">
        Sources linked when they speak to the same point. Orange marks disagreement; numbers match
        the source cards.
      </p>

      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto mt-3 h-auto w-full max-w-sm">
        {agree.map((e, i) =>
          line(e, { stroke: '#0F766E', strokeOpacity: 0.18, strokeWidth: 1 }, `a${i}`),
        )}
        {disagree.map((e, i) =>
          line(e, { stroke: '#C2410C', strokeOpacity: 0.85, strokeWidth: 2 }, `d${i}`),
        )}
        {nodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          const color = COLOR[trustTier(n.trustScore)];
          return (
            <g key={n.id}>
              <title>{`[${n.index}] ${n.domain}, trust ${n.trustScore}`}</title>
              <circle
                cx={p.x}
                cy={p.y}
                r={13}
                fill={color}
                fillOpacity={0.15}
                stroke={color}
                strokeWidth={1.5}
              />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-ink font-mono"
                fontSize="11"
                fontWeight="600"
              >
                {n.index}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center gap-4 font-mono text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={{ backgroundColor: '#0F766E', opacity: 0.4 }}
          />
          agree
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: '#C2410C' }} />
          disagree
        </span>
      </div>
    </figure>
  );
}
