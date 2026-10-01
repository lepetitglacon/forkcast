import { describe, expect, it } from 'vitest';
import { buildSnapshot, createDocFromJson, exampleTreeJson } from '@forkcast/doc';
import { applyFreePositions, layoutTree, snapToGridPoint, DEFAULT_NODE_HEIGHT, LEVEL_GAP, NODE_WIDTH } from './useLayout';

const tree = buildSnapshot(createDocFromJson(exampleTreeJson()));

function overlaps(a: { y: number; height: number }, b: { y: number; height: number }): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

describe('layoutTree', () => {
  it('places the root at the left and children one level to the right', () => {
    const { nodes, edges } = layoutTree(tree, new Set());
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    expect(nodes).toHaveLength(Object.keys(tree.nodes).length);
    expect(byId.root?.x).toBe(0);
    expect(byId.psp?.x).toBe(NODE_WIDTH + LEVEL_GAP);
    expect(byId.stripe?.x).toBe(2 * (NODE_WIDTH + LEVEL_GAP));
    expect(edges.find((e) => e.source === 'psp' && e.target === 'stripe')).toBeDefined();
    expect(edges).toHaveLength(nodes.length - 1);
  });

  it('never overlaps siblings, even with measured heights', () => {
    const sizes = { stripe: { width: NODE_WIDTH, height: 200 }, adyen: { width: NODE_WIDTH, height: 120 } };
    const { nodes } = layoutTree(tree, new Set(), sizes);
    const siblings = nodes.filter((n) => ['stripe', 'adyen', 'mollie', 'paypal'].includes(n.id));
    expect(siblings.find((n) => n.id === 'stripe')?.height).toBe(200);
    expect(siblings.find((n) => n.id === 'mollie')?.height).toBe(DEFAULT_NODE_HEIGHT);
    for (const a of siblings) for (const b of siblings) if (a !== b) expect(overlaps(a, b)).toBe(false);
  });

  it('hides the subtree of collapsed nodes and counts the hidden descendants', () => {
    const { nodes, hiddenCounts } = layoutTree(tree, new Set(['psp', 'billing']));
    const ids = new Set(nodes.map((n) => n.id));
    expect(ids.has('psp')).toBe(true);
    expect(ids.has('stripe')).toBe(false);
    expect(ids.has('sendgrid')).toBe(false);
    expect(hiddenCounts.psp).toBe(4);
    expect(hiddenCounts.billing).toBe(4);
  });

  it('returns an empty layout for an empty tree', () => {
    expect(layoutTree({ meta: { schemaVersion: 1, title: '', rootId: '' }, criteria: [], nodes: {}, children: {} }, new Set())).toEqual({
      nodes: [],
      edges: [],
      hiddenCounts: {},
    });
  });
});

describe('layoutTree orientations', () => {
  const center = (n: { x: number; y: number; width: number; height: number }) => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 });
  const byId = (o: 'lr' | 'rl' | 'tb' | 'bt') =>
    Object.fromEntries(layoutTree(tree, new Set(), {}, o).nodes.map((n) => [n.id, n] as const));

  it('grows to the right, left, bottom and top from the root', () => {
    const lr = byId('lr');
    const rl = byId('rl');
    const tb = byId('tb');
    const bt = byId('bt');
    expect(center(lr.psp!).x).toBeGreaterThan(center(lr.root!).x);
    expect(center(rl.psp!).x).toBeLessThan(center(rl.root!).x);
    expect(center(tb.psp!).y).toBeGreaterThan(center(tb.root!).y);
    expect(center(bt.psp!).y).toBeLessThan(center(bt.root!).y);
    // siblings are spread along the other axis
    expect(center(lr.psp!).x).toBe(center(lr.hosting!).x);
    expect(center(tb.psp!).y).toBe(center(tb.hosting!).y);
    expect(center(tb.psp!).x).not.toBe(center(tb.hosting!).x);
  });

  it('never overlaps cards side by side in vertical layouts', () => {
    const nodes = layoutTree(tree, new Set(), {}, 'tb').nodes;
    const level = nodes.filter((n) => n.depth === 2).sort((a, b) => a.x - b.x);
    for (let i = 1; i < level.length; i++) expect(level[i]!.x).toBeGreaterThanOrEqual(level[i - 1]!.x + level[i - 1]!.width);
  });
});

describe('applyFreePositions', () => {
  const layout = layoutTree(tree, new Set());
  const auto = Object.fromEntries(layout.nodes.map((n) => [n.id, n] as const));

  it('returns the auto layout untouched when nothing is placed', () => {
    expect(applyFreePositions(layout, tree, {})).toBe(layout);
  });

  it('places stored cards and carries their auto-laid-out subtree along', () => {
    const moved = applyFreePositions(layout, tree, { psp: { x: auto.psp!.x + 100, y: auto.psp!.y - 40 } });
    const by = Object.fromEntries(moved.nodes.map((n) => [n.id, n] as const));
    expect(by.psp).toMatchObject({ x: auto.psp!.x + 100, y: auto.psp!.y - 40 });
    expect(by.stripe).toMatchObject({ x: auto.stripe!.x + 100, y: auto.stripe!.y - 40 });
    expect(by.hosting).toMatchObject({ x: auto.hosting!.x, y: auto.hosting!.y });
    expect(by.root).toBe(auto.root);
  });

  it('lets a placed child keep its own absolute position', () => {
    const moved = applyFreePositions(layout, tree, {
      psp: { x: 1000, y: 1000 },
      stripe: { x: -50, y: -60 },
    });
    const by = Object.fromEntries(moved.nodes.map((n) => [n.id, n] as const));
    expect(by.stripe).toMatchObject({ x: -50, y: -60 });
    expect(by.adyen!.x - by.psp!.x).toBe(auto.adyen!.x - auto.psp!.x);
  });

  it('snaps points to the grid', () => {
    expect(snapToGridPoint({ x: 23, y: -9 })).toEqual({ x: 16, y: -16 });
  });
});
