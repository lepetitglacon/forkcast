import type { Aggregation, Criterion, Direction, NodeKind, Tree, TreeNode } from '@forkcast/shared';

export interface Spec {
  id?: string;
  label?: string;
  kind?: NodeKind;
  optional?: boolean;
  values?: Record<string, number>;
  children?: Spec[];
}

export type CriterionSpec = Partial<Criterion> & { id: string };

/** Build a snapshot directly (no Yjs) from a nested spec. Ids default to n1, n2… in DFS order. */
export function buildTree(root: Spec, criteria: CriterionSpec[], title = 'test'): Tree {
  const nodes: Record<string, TreeNode> = {};
  const children: Record<string, string[]> = {};
  let counter = 0;
  const visit = (spec: Spec, parentId: string | null, orderKey: string): string => {
    const id = spec.id ?? `n${++counter}`;
    const kids = spec.children ?? [];
    const kind: NodeKind = spec.kind ?? (kids.length > 0 ? 'and' : 'leaf');
    const node: TreeNode = {
      id,
      parentId,
      orderKey,
      label: spec.label ?? id,
      kind,
      values: Object.fromEntries(Object.entries(spec.values ?? {}).map(([k, v]) => [k, { value: v }])),
    };
    if (spec.optional) node.optional = true;
    nodes[id] = node;
    children[id] = kids.map((k, i) => visit(k, id, `a${i}`));
    return id;
  };
  const rootId = visit(root, null, 'a0');
  return {
    meta: { schemaVersion: 1, title, rootId },
    criteria: criteria.map((c, i) => ({
      id: c.id,
      label: c.label ?? c.id,
      unit: c.unit,
      aggregation: c.aggregation ?? 'sum',
      direction: c.direction ?? 'minimize',
      order: c.order ?? i,
    })),
    nodes,
    children,
  };
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AGGS: Aggregation[] = ['sum', 'max', 'min', 'probOr'];
const DIRS: Direction[] = ['minimize', 'maximize'];

export function randomTree(seed: number, maxDepth = 4): Tree {
  const r = rng(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(r() * arr.length)]!;
  const nCrit = 2 + Math.floor(r() * 2);
  const criteria: CriterionSpec[] = [];
  for (let i = 0; i < nCrit; i++) {
    criteria.push({ id: `c${i}`, aggregation: pick(AGGS), direction: pick(DIRS) });
  }
  const values = (): Record<string, number> => {
    const v: Record<string, number> = {};
    for (const c of criteria) {
      if (r() < 0.7) {
        v[c.id] =
          c.aggregation === 'probOr' ? Math.round(r() * 50) / 100 : Math.floor(r() * 21) - 5;
      }
    }
    return v;
  };
  const gen = (depth: number): Spec => {
    const leaf = depth >= maxDepth || r() < 0.3;
    if (leaf) return { values: values() };
    const n = 1 + Math.floor(r() * 3);
    const children: Spec[] = [];
    for (let i = 0; i < n; i++) {
      const child = gen(depth + 1);
      if (r() < 0.25) child.optional = true;
      children.push(child);
    }
    return { kind: r() < 0.5 ? 'or' : 'and', values: r() < 0.3 ? values() : {}, children };
  };
  return buildTree(gen(0), criteria, `random-${seed}`);
}
