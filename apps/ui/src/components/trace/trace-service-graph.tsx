import { useMemo } from 'react';
import { buildServiceGraph, formatMs, serviceColor } from './trace.layout';
import type { TraceSpan } from './trace.types';

const NODE_W = 150;
const NODE_H = 52;
const COL_GAP = 90;
const ROW_GAP = 22;
const PAD = 16;

export function TraceServiceGraph({ spans, services }: { spans: TraceSpan[]; services: string[] }) {
  const { nodes, edges, positions, width, height } = useMemo(() => {
    const graph = buildServiceGraph(spans);
    const columns = new Map<number, typeof graph.nodes>();
    for (const node of graph.nodes) columns.set(node.layer, [...(columns.get(node.layer) ?? []), node]);
    const layerCount = Math.max(...columns.keys(), 0) + 1;
    const tallest = Math.max(...[...columns.values()].map((c) => c.length), 1);
    const positions = new Map<string, { x: number; y: number }>();
    const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP;
    for (const [layer, list] of columns) {
      const colHeight = list.length * NODE_H + (list.length - 1) * ROW_GAP;
      list.forEach((node, i) => positions.set(node.service, { x: PAD + layer * (NODE_W + COL_GAP), y: (height - colHeight) / 2 + i * (NODE_H + ROW_GAP) }));
    }
    return { ...graph, positions, width: PAD * 2 + layerCount * NODE_W + (layerCount - 1) * COL_GAP, height };
  }, [spans]);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Service dependency graph" className="mx-auto block">
        <defs>
          <marker id="trace-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L8 4L0 8z" className="fill-muted-foreground" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const a = positions.get(edge.from);
          const b = positions.get(edge.to);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_H / 2;
          const mid = (x1 + x2) / 2;
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <path d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2 - 2},${y2}`} fill="none" strokeWidth={1.5} className="stroke-muted-foreground" markerEnd="url(#trace-arrow)" />
              <text x={mid} y={(y1 + y2) / 2 - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{edge.count} call{edge.count > 1 ? 's' : ''}</text>
            </g>
          );
        })}
        {nodes.map((node) => {
          const p = positions.get(node.service)!;
          const color = node.errorCount ? '#DC2626' : serviceColor(services, node.service);
          return (
            <g key={node.service} transform={`translate(${p.x},${p.y})`}>
              <rect width={NODE_W} height={NODE_H} rx={10} className="fill-card stroke-border" />
              <rect width={4} height={NODE_H} rx={2} fill={color} />
              <text x={14} y={21} className="fill-foreground text-[12px] font-medium">{node.service.length > 18 ? `${node.service.slice(0, 17)}…` : node.service}</text>
              <text x={14} y={38} className="fill-muted-foreground text-[10px]">{node.spanCount} spans · {formatMs(node.totalMs)}{node.errorCount ? ` · ${node.errorCount} err` : ''}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
