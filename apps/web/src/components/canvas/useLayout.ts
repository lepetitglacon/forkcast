import { useMemo } from 'react';
import { hierarchy, tree as d3tree } from 'd3-hierarchy';
import type { Tree } from '@forkcast/shared';
import { subtreeIds } from '@forkcast/doc';
import { isHorizontal, type Orientation } from '@/lib/orientation';

export const NODE_WIDTH = 240;
export const DEFAULT_NODE_HEIGHT = 64;
/** Gap between two levels (horizontal layouts). */
export const LEVEL_GAP = 96;
/** Gap between two neighbouring cards (horizontal layouts). */
export const SIBLING_GAP = 22;
/** Gaps of vertical layouts (levels stack vertically, siblings side by side). */
export const VERTICAL_LEVEL_GAP = 72;
export const VERTICAL_SIBLING_GAP = 28;
/** Grid of the "Grille magnétique" option. */
export const GRID_SIZE = 16;

export interface NodeSize {
  width: number;
  height: number;
}

export interface XY {
  x: number;
  y: number;
}

export interface LayoutNode {
  id: string;
  /** Top-left corner (React Flow position). */
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
}

export interface LayoutResult {
  /** Parents always come before their children (breadth-first order). */
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  /** Number of hidden descendants per collapsed node. */
  hiddenCounts: Record<string, number>;
}

const EMPTY_LAYOUT: LayoutResult = { nodes: [], edges: [], hiddenCounts: {} };

/**
 * Tidy tree layout (d3-hierarchy) in one of four orientations. Node positions are derived
 * from the snapshot and never stored. Collapsed nodes hide their subtree. Measured sizes,
 * when known, drive the spacing so that cards never overlap.
 */
export function layoutTree(
  tree: Tree,
  collapsed: ReadonlySet<string>,
  sizes: Readonly<Record<string, NodeSize>> = {},
  orientation: Orientation = 'lr',
): LayoutResult {
  const rootId = tree.meta.rootId;
  if (!rootId || !tree.nodes[rootId]) return EMPTY_LAYOUT;
  const horizontal = isHorizontal(orientation);
  const widthOf = (id: string) => sizes[id]?.width ?? NODE_WIDTH;
  const heightOf = (id: string) => sizes[id]?.height ?? DEFAULT_NODE_HEIGHT;
  /** Extent along the axis where siblings are spread. */
  const breadthOf = horizontal ? heightOf : widthOf;
  /** Extent along the axis where levels follow each other. */
  const depthOf = horizontal ? widthOf : heightOf;
  const siblingGap = horizontal ? SIBLING_GAP : VERTICAL_SIBLING_GAP;
  const levelGap = horizontal ? LEVEL_GAP : VERTICAL_LEVEL_GAP;

  const root = hierarchy<string>(rootId, (id) => (collapsed.has(id) ? [] : (tree.children[id] ?? [])));
  const positioned = d3tree<string>()
    .nodeSize([1, 1])
    .separation((a, b) => (breadthOf(a.data) + breadthOf(b.data)) / 2 + siblingGap)(root);

  const levelSize: number[] = [];
  positioned.each((d) => {
    levelSize[d.depth] = Math.max(levelSize[d.depth] ?? 0, depthOf(d.data));
  });
  const levelStart: number[] = [];
  let acc = 0;
  for (let depth = 0; depth < levelSize.length; depth++) {
    levelStart[depth] = acc;
    acc += (levelSize[depth] ?? 0) + levelGap;
  }

  const nodes: LayoutNode[] = positioned.descendants().map((d) => {
    const width = widthOf(d.data);
    const height = heightOf(d.data);
    const start = levelStart[d.depth] ?? 0;
    let x: number;
    let y: number;
    switch (orientation) {
      case 'lr':
        x = start;
        y = d.x - height / 2;
        break;
      case 'rl':
        x = -start - width;
        y = d.x - height / 2;
        break;
      case 'tb':
        x = d.x - width / 2;
        y = start;
        break;
      case 'bt':
        x = d.x - width / 2;
        y = -start - height;
        break;
    }
    return { id: d.data, x: Math.round(x), y: Math.round(y), width, height, depth: d.depth };
  });
  const edges: LayoutEdge[] = positioned.links().map((l) => ({
    id: `${l.source.data}->${l.target.data}`,
    source: l.source.data,
    target: l.target.data,
  }));

  const hiddenCounts: Record<string, number> = {};
  for (const id of collapsed) {
    if (!tree.nodes[id] || (tree.children[id] ?? []).length === 0) continue;
    hiddenCounts[id] = subtreeIds(tree, id).length - 1;
  }
  return { nodes, edges, hiddenCounts };
}

/**
 * Free-move mode: cards with a stored position are placed there; every other card keeps
 * its auto-layout place shifted by the offset of its nearest positioned ancestor, so that
 * moving a card carries its (auto-laid-out) subtree along.
 */
export function applyFreePositions(
  layout: LayoutResult,
  tree: Tree,
  stored: Readonly<Record<string, XY>>,
): LayoutResult {
  let any = false;
  for (const n of layout.nodes) {
    if (stored[n.id]) {
      any = true;
      break;
    }
  }
  if (!any) return layout;
  const offsets = new Map<string, XY>();
  const nodes = layout.nodes.map((n) => {
    const s = stored[n.id];
    let offset: XY;
    if (s) offset = { x: s.x - n.x, y: s.y - n.y };
    else {
      const parentId = tree.nodes[n.id]?.parentId;
      offset = (parentId ? offsets.get(parentId) : undefined) ?? { x: 0, y: 0 };
    }
    offsets.set(n.id, offset);
    return offset.x === 0 && offset.y === 0 ? n : { ...n, x: n.x + offset.x, y: n.y + offset.y };
  });
  return { ...layout, nodes };
}

export function snapToGridPoint(p: XY, grid = GRID_SIZE): XY {
  return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
}

export function useLayout(
  tree: Tree,
  collapsed: ReadonlySet<string>,
  sizes: Readonly<Record<string, NodeSize>>,
  orientation: Orientation,
): LayoutResult {
  return useMemo(() => layoutTree(tree, collapsed, sizes, orientation), [tree, collapsed, sizes, orientation]);
}
