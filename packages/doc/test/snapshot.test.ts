import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { addChild, buildSnapshot, buildSnapshotWithRepairs, createDoc, getNodes, initDoc, isInitialized, makeNodeMap } from '../src';
import { clone, sync } from './helpers';

describe('initDoc / buildSnapshot', () => {
  it('creates meta and a root AND node', () => {
    const doc = createDoc({ title: 'Hello', rootId: 'r' });
    expect(isInitialized(doc)).toBe(true);
    const tree = buildSnapshot(doc);
    expect(tree.meta).toEqual({ schemaVersion: 1, title: 'Hello', rootId: 'r' });
    expect(tree.nodes['r']).toMatchObject({ id: 'r', parentId: null, kind: 'and', label: 'Hello' });
    expect(tree.children['r']).toEqual([]);
    expect(initDoc(doc, { title: 'again' })).toBe('r');
  });

  it('returns an empty tree for an empty document', () => {
    const tree = buildSnapshot(new Y.Doc());
    expect(tree.meta.rootId).toBe('');
    expect(tree.nodes).toEqual({});
  });

  it('orders siblings by orderKey then id', () => {
    const doc = createDoc({ rootId: 'r' });
    const nodes = getNodes(doc);
    for (const [id, orderKey] of [
      ['b', 'a1'],
      ['a', 'a1'],
      ['c', 'a0'],
    ] as const) {
      nodes.set(id, makeNodeMap({ id, parentId: 'r', orderKey, label: id, kind: 'leaf', values: {} }));
    }
    expect(buildSnapshot(doc).children['r']).toEqual(['c', 'a', 'b']);
  });

  it('re-attaches orphans (missing or self parent) to the root', () => {
    const doc = createDoc({ rootId: 'r' });
    const nodes = getNodes(doc);
    nodes.set('x', makeNodeMap({ id: 'x', parentId: 'ghost', orderKey: 'a0', label: 'x', kind: 'leaf', values: {} }));
    nodes.set('y', makeNodeMap({ id: 'y', parentId: 'y', orderKey: 'a0', label: 'y', kind: 'leaf', values: {} }));
    nodes.set('z', makeNodeMap({ id: 'z', parentId: null, orderKey: 'a0', label: 'z', kind: 'leaf', values: {} }));
    const { tree, repairs } = buildSnapshotWithRepairs(doc);
    expect(repairs.orphans.sort()).toEqual(['x', 'y', 'z']);
    expect(tree.children['r']).toEqual(['x', 'y', 'z']);
    expect(tree.nodes['x']!.parentId).toBe('r');
  });

  it('breaks cycles by attaching the smallest id of the cycle to the root', () => {
    const doc = createDoc({ rootId: 'r' });
    const nodes = getNodes(doc);
    // b → c → d → b (cycle), e → b
    nodes.set('b', makeNodeMap({ id: 'b', parentId: 'd', orderKey: 'a0', label: 'b', kind: 'and', values: {} }));
    nodes.set('c', makeNodeMap({ id: 'c', parentId: 'b', orderKey: 'a0', label: 'c', kind: 'and', values: {} }));
    nodes.set('d', makeNodeMap({ id: 'd', parentId: 'c', orderKey: 'a0', label: 'd', kind: 'and', values: {} }));
    nodes.set('e', makeNodeMap({ id: 'e', parentId: 'b', orderKey: 'a0', label: 'e', kind: 'leaf', values: {} }));
    const { tree, repairs } = buildSnapshotWithRepairs(doc);
    expect(repairs.cycles).toEqual(['b']);
    expect(tree.nodes['b']!.parentId).toBe('r');
    expect(tree.children['r']).toEqual(['b']);
    expect(tree.children['b']).toEqual(['c', 'e']);
    expect(tree.children['c']).toEqual(['d']);
    expect(Object.values(tree.children).flat().length).toBe(4);
  });

  it('falls back to a deterministic root when meta.rootId is missing', () => {
    const doc = new Y.Doc();
    const nodes = getNodes(doc);
    nodes.set('m', makeNodeMap({ id: 'm', parentId: null, orderKey: 'a0', label: 'm', kind: 'and', values: {} }));
    nodes.set('k', makeNodeMap({ id: 'k', parentId: null, orderKey: 'a0', label: 'k', kind: 'and', values: {} }));
    const tree = buildSnapshot(doc);
    expect(tree.meta.rootId).toBe('k');
    expect(tree.children['k']).toEqual(['m']);
  });

  it('yields the same snapshot on two clients after concurrent moves creating a cycle', () => {
    const a = createDoc({ rootId: 'r' });
    const x = addChild(a, { parentId: 'r', node: { label: 'x', kind: 'and' }, id: 'x' }).result.id;
    const y = addChild(a, { parentId: 'r', node: { label: 'y', kind: 'and' }, id: 'y' }).result.id;
    const b = clone(a);
    // offline: a moves x under y, b moves y under x
    getNodes(a).get(x)!.set('parentId', y);
    getNodes(b).get(y)!.set('parentId', x);
    sync(a, b);
    const ta = buildSnapshot(a);
    const tb = buildSnapshot(b);
    expect(ta).toEqual(tb);
    // cycle x ↔ y broken: 'x' (smallest id) goes back to the root
    expect(ta.nodes['x']!.parentId).toBe('r');
    expect(ta.nodes['y']!.parentId).toBe('x');
  });
});
