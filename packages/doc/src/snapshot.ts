import type * as Y from 'yjs';
import type { Criterion, Tree, TreeNode } from '@forkcast/shared';
import { readCriterion, readNode } from './nodes';
import { getCriteria, getMeta, getNodes, SCHEMA_VERSION } from './schema';

export const EMPTY_TREE: Tree = {
  meta: { schemaVersion: SCHEMA_VERSION, title: '', rootId: '' },
  criteria: [],
  nodes: {},
  children: {},
};

export interface SnapshotRepairs {
  /** Nodes re-attached to the root because their parent was missing or themselves. */
  orphans: string[];
  /** Nodes re-attached to the root to break a cycle (smallest id of each cycle). */
  cycles: string[];
}

export interface SnapshotResult {
  tree: Tree;
  repairs: SnapshotRepairs;
}

function compareKeys(a: TreeNode, b: TreeNode): number {
  if (a.orderKey < b.orderKey) return -1;
  if (a.orderKey > b.orderKey) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function compareCriteria(a: Criterion, b: Criterion): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Build the immutable snapshot of a document, repairing inconsistencies the same way on
 * every client (concurrent moves can create cycles, concurrent remove + add can leave a
 * parent pointing to a deleted node):
 *  - parent missing / parent = self / parent null on a non-root node → attached to the root;
 *  - cycle → the node with the smallest id in the cycle is attached to the root;
 *  - siblings are ordered by (orderKey, id), so colliding order keys stay deterministic.
 * The document itself is never written.
 */
export function buildSnapshotWithRepairs(doc: Y.Doc): SnapshotResult {
  const repairs: SnapshotRepairs = { orphans: [], cycles: [] };
  const nodes: Record<string, TreeNode> = {};
  getNodes(doc).forEach((map, key) => {
    const node = readNode(map, key);
    if (node) nodes[node.id] = node;
  });
  const ids = Object.keys(nodes).sort();
  const meta = getMeta(doc);
  const schemaVersionRaw = meta.get('schemaVersion');
  const titleRaw = meta.get('title');
  const schemaVersion = typeof schemaVersionRaw === 'number' ? schemaVersionRaw : SCHEMA_VERSION;
  const title = typeof titleRaw === 'string' ? titleRaw : '';

  if (ids.length === 0) {
    return { tree: { ...EMPTY_TREE, meta: { schemaVersion, title, rootId: '' } }, repairs };
  }

  const rootIdRaw = meta.get('rootId');
  const rootId: string =
    typeof rootIdRaw === 'string' && nodes[rootIdRaw]
      ? rootIdRaw
      : (ids.find((id) => nodes[id]!.parentId === null) ?? ids[0]!);

  // 1. parent resolution
  const parent: Record<string, string | null> = {};
  for (const id of ids) {
    if (id === rootId) {
      parent[id] = null;
      continue;
    }
    const p: string | null = nodes[id]!.parentId;
    if (p === null || p === id || !nodes[p]) {
      parent[id] = rootId;
      if (p !== rootId) repairs.orphans.push(id);
    } else parent[id] = p;
  }

  // 2. cycle breaking
  const state: Record<string, 0 | 1 | 2> = {};
  state[rootId] = 2;
  for (const start of ids) {
    if (state[start] === 2) continue;
    let path: string[] = [];
    let cur = start;
    for (;;) {
      if (state[cur] === 2) break;
      if (state[cur] === 1) {
        // cycle: cur is in path
        const cycle = path.slice(path.indexOf(cur));
        const victim = [...cycle].sort()[0]!;
        parent[victim] = rootId;
        repairs.cycles.push(victim);
        for (const p of path) state[p] = 0;
        path = [];
        cur = start;
        continue;
      }
      state[cur] = 1;
      path.push(cur);
      cur = parent[cur] as string;
    }
    for (const p of path) state[p] = 2;
  }

  // 3. children lists
  const children: Record<string, string[]> = {};
  for (const id of ids) children[id] = [];
  for (const id of ids) {
    const p: string | null = id === rootId ? null : (parent[id] ?? rootId);
    nodes[id] = { ...nodes[id]!, parentId: p };
    if (p !== null) children[p]!.push(id);
  }
  for (const id of ids) children[id]!.sort((a, b) => compareKeys(nodes[a]!, nodes[b]!));

  // 4. criteria
  const criteria: Criterion[] = [];
  getCriteria(doc).forEach((map, key) => {
    const c = readCriterion(map, key);
    if (c) criteria.push(c);
  });
  criteria.sort(compareCriteria);

  return { tree: { meta: { schemaVersion, title, rootId }, criteria, nodes, children }, repairs };
}

export function buildSnapshot(doc: Y.Doc): Tree {
  return buildSnapshotWithRepairs(doc).tree;
}

/** Ids of `nodeId` and all its descendants (depth-first, parents first). */
export function subtreeIds(tree: Tree, nodeId: string): string[] {
  const out: string[] = [];
  const visit = (id: string): void => {
    if (!tree.nodes[id]) return;
    out.push(id);
    for (const c of tree.children[id] ?? []) visit(c);
  };
  visit(nodeId);
  return out;
}

export function isAncestor(tree: Tree, ancestorId: string, nodeId: string): boolean {
  let cur: string | null | undefined = tree.nodes[nodeId]?.parentId;
  let guard = 0;
  while (cur !== null && cur !== undefined && guard++ < 100_000) {
    if (cur === ancestorId) return true;
    cur = tree.nodes[cur]?.parentId;
  }
  return false;
}

export function depthOf(tree: Tree, nodeId: string): number {
  let depth = 0;
  let cur = tree.nodes[nodeId]?.parentId;
  while (cur !== null && cur !== undefined) {
    depth++;
    cur = tree.nodes[cur]?.parentId;
  }
  return depth;
}
