import type { Edge, Node } from '@xyflow/react';
import type { NodeKind, Tree } from '@forkcast/shared';
import type { NodeAggregate } from '@forkcast/engine';
import { formatRange, formatValue } from '@/lib/format';
import type { Orientation } from '@/lib/orientation';
import type { PresenceUser } from '@/docs/usePresence';
import { DEFAULT_NODE_HEIGHT, NODE_WIDTH, type LayoutResult, type XY } from './useLayout';

export interface ValueRow {
  criterionId: string;
  label: string;
  text: string;
  ai: boolean;
}

export interface AggregateRow {
  criterionId: string;
  label: string;
  text: string;
  /** False when the subtree holds choices (the text is a range). */
  exact: boolean;
}

export interface TreeNodeData extends Record<string, unknown> {
  nodeId: string;
  label: string;
  kind: NodeKind;
  optional: boolean;
  isRoot: boolean;
  parentKind: NodeKind | null;
  hasChildren: boolean;
  collapsed: boolean;
  hiddenCount: number;
  notes: string;
  values: ValueRow[];
  aggregates: AggregateRow[];
  highlighted: boolean;
  dimmed: boolean;
  aiHighlighted: boolean;
  dropTarget: boolean;
  renaming: boolean;
  readOnly: boolean;
  sketch: boolean;
  orientation: Orientation;
  presence: PresenceUser[];
}

export type FlowNode = Node<TreeNodeData, 'tree'>;
export type FlowEdge = Edge;

export interface BuildNodesInput {
  tree: Tree;
  layout: LayoutResult;
  aggregates: Record<string, NodeAggregate>;
  measured: Readonly<Record<string, { width: number; height: number }>>;
  /** Position override of the card being dragged (auto-layout mode). */
  dragPosition: { id: string; position: XY } | null;
  selectedId: string | null;
  renamingId: string | null;
  highlighted: ReadonlySet<string>;
  aiHighlighted: ReadonlySet<string>;
  dropTargetId: string | null;
  presenceByNode: ReadonlyMap<string, PresenceUser[]>;
  readOnly: boolean;
  sketch: boolean;
  freeMove: boolean;
  orientation: Orientation;
}

const NO_PRESENCE: PresenceUser[] = [];

function sameRows<T extends object>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as Record<string, unknown>;
    const y = b[i] as Record<string, unknown>;
    for (const key of Object.keys(x)) if (x[key] !== y[key]) return false;
  }
  return true;
}

function sameData(a: TreeNodeData, b: TreeNodeData): boolean {
  for (const key of Object.keys(a) as Array<keyof TreeNodeData>) {
    if (key === 'values' || key === 'aggregates' || key === 'presence') continue;
    if (a[key] !== b[key]) return false;
  }
  return sameRows(a.values, b.values) && sameRows(a.aggregates, b.aggregates) && sameRows(a.presence, b.presence);
}

function sameNode(a: FlowNode, b: FlowNode): boolean {
  return (
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.selected === b.selected &&
    a.draggable === b.draggable &&
    a.measured?.width === b.measured?.width &&
    a.measured?.height === b.measured?.height &&
    a.initialWidth === b.initialWidth &&
    sameData(a.data, b.data)
  );
}

/**
 * React Flow nodes for the laid out tree. `cache` keeps the previous objects: unchanged
 * cards keep the same identity, so dragging one card or a remote cursor moving does not
 * re-render every card.
 */
export function buildFlowNodes(input: BuildNodesInput, cache?: Map<string, FlowNode>): FlowNode[] {
  const { tree, layout, aggregates } = input;
  const hasHighlight = input.highlighted.size > 0;
  const out: FlowNode[] = [];
  const seen = new Set<string>();
  for (const ln of layout.nodes) {
    const node = tree.nodes[ln.id];
    if (!node) continue;
    const children = tree.children[ln.id] ?? [];
    const agg = aggregates[ln.id];
    const values: ValueRow[] = [];
    const aggregateRows: AggregateRow[] = [];
    for (const c of tree.criteria) {
      const v = node.values[c.id];
      if (v) values.push({ criterionId: c.id, label: c.label, text: formatValue(c, v.value), ai: v.estimatedBy === 'ai' });
      if (agg && children.length > 0) {
        const min = agg.min[c.id];
        const max = agg.max[c.id];
        if (min !== undefined || max !== undefined) {
          aggregateRows.push({
            criterionId: c.id,
            label: c.label,
            text: agg.hasChoices ? formatRange(c, min, max) : formatValue(c, max ?? min),
            exact: !agg.hasChoices,
          });
        }
      }
    }
    const isRoot = ln.id === tree.meta.rootId;
    const parent = node.parentId ? tree.nodes[node.parentId] : undefined;
    const size = input.measured[ln.id];
    const data: TreeNodeData = {
      nodeId: ln.id,
      label: node.label,
      kind: node.kind,
      optional: node.optional === true && !isRoot,
      isRoot,
      parentKind: parent?.kind ?? null,
      hasChildren: children.length > 0,
      collapsed: ln.id in layout.hiddenCounts,
      hiddenCount: layout.hiddenCounts[ln.id] ?? 0,
      notes: node.notes ?? '',
      values,
      aggregates: aggregateRows,
      highlighted: input.highlighted.has(ln.id),
      dimmed: hasHighlight && !input.highlighted.has(ln.id),
      aiHighlighted: input.aiHighlighted.has(ln.id),
      dropTarget: input.dropTargetId === ln.id,
      renaming: input.renamingId === ln.id,
      readOnly: input.readOnly,
      sketch: input.sketch,
      orientation: input.orientation,
      presence: input.presenceByNode.get(ln.id) ?? NO_PRESENCE,
    };
    const dragged = input.dragPosition?.id === ln.id ? input.dragPosition.position : null;
    const next: FlowNode = {
      id: ln.id,
      type: 'tree',
      position: dragged ?? { x: ln.x, y: ln.y },
      data,
      selected: input.selectedId === ln.id,
      // Free move: any card (even the root, even read-only) can be placed; otherwise drag = re-parent.
      draggable: input.freeMove || (!input.readOnly && !isRoot),
      // Unmeasured cards get a provisional size: React Flow keeps cards without dimensions
      // hidden (and unfocusable) until its ResizeObserver runs, which a background tab defers.
      ...(size ? { measured: size } : { initialWidth: NODE_WIDTH, initialHeight: DEFAULT_NODE_HEIGHT }),
    };
    const prev = cache?.get(ln.id);
    const node2 = prev && sameNode(prev, next) ? prev : next;
    cache?.set(ln.id, node2);
    seen.add(ln.id);
    out.push(node2);
  }
  if (cache) for (const id of [...cache.keys()]) if (!seen.has(id)) cache.delete(id);
  return out;
}

export function buildFlowEdges(layout: LayoutResult, highlighted: ReadonlySet<string>): FlowEdge[] {
  const hasHighlight = highlighted.size > 0;
  return layout.edges.map((e) => {
    const inPath = hasHighlight && highlighted.has(e.source) && highlighted.has(e.target);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: 'out',
      targetHandle: 'in',
      type: 'smoothstep',
      className: inPath ? 'fc-highlight' : hasHighlight ? 'fc-dim' : undefined,
      zIndex: inPath ? 1 : 0,
    };
  });
}
