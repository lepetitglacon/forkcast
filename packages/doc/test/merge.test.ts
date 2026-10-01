import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { addChild, addSubtree, buildSnapshot, move, remove, rename, setValues } from '../src';
import { clone, docWithCriteria, shape, sync } from './helpers';

describe('offline divergence then merge', () => {
  it('concurrent adds under the same parent keep a stable, identical order everywhere', () => {
    const a = docWithCriteria();
    addChild(a, { parentId: 'root', node: { label: 'x' }, id: 'x' });
    const b = clone(a);
    addChild(a, { parentId: 'root', node: { label: 'from a' }, id: 'fa' });
    addChild(b, { parentId: 'root', node: { label: 'from b' }, id: 'fb' });
    sync(a, b);
    const ta = buildSnapshot(a);
    expect(shape(ta)).toEqual(shape(buildSnapshot(b)));
    expect([...ta.children['root']!].sort()).toEqual(['fa', 'fb', 'x']);
    expect(ta.children['root']![0]).toBe('x');
  });

  it('a move and a removal of the same branch converge without duplicates', () => {
    const a = docWithCriteria();
    addSubtree(a, { parentId: 'root', subtree: { id: 'p', label: 'p', children: [{ id: 'c', label: 'c' }] } });
    addChild(a, { parentId: 'root', node: { label: 'q' }, id: 'q' });
    const b = clone(a);
    move(a, { nodeId: 'c', parentId: 'q' });
    remove(b, { nodeId: 'p' });
    sync(a, b);
    const ta = buildSnapshot(a);
    expect(ta).toEqual(buildSnapshot(b));
    // Y.Map delete wins over the concurrent field update on the same entry: c is gone
    expect(ta.nodes['c']).toBeUndefined();
    expect(ta.nodes['p']).toBeUndefined();
    expect(Object.keys(ta.nodes).sort()).toEqual(['q', 'root']);
  });

  it('a node added under a concurrently removed parent is re-attached to the root', () => {
    const a = docWithCriteria();
    addChild(a, { parentId: 'root', node: { label: 'p' }, id: 'p' });
    const b = clone(a);
    addChild(a, { parentId: 'p', node: { label: 'late' }, id: 'late' });
    remove(b, { nodeId: 'p' });
    sync(a, b);
    const ta = buildSnapshot(a);
    expect(ta).toEqual(buildSnapshot(b));
    expect(ta.nodes['late']!.parentId).toBe('root');
    expect(ta.children['root']).toEqual(['late']);
  });

  it('cross moves creating a cycle are repaired identically', () => {
    const a = docWithCriteria();
    addChild(a, { parentId: 'root', node: { label: 'x', kind: 'and' }, id: 'x' });
    addChild(a, { parentId: 'root', node: { label: 'y', kind: 'and' }, id: 'y' });
    const b = clone(a);
    move(a, { nodeId: 'x', parentId: 'y' });
    move(b, { nodeId: 'y', parentId: 'x' });
    sync(a, b);
    const ta = buildSnapshot(a);
    expect(ta).toEqual(buildSnapshot(b));
    const reachable = new Set<string>();
    const visit = (id: string): void => {
      reachable.add(id);
      for (const c of ta.children[id] ?? []) visit(c);
    };
    visit('root');
    expect(reachable.size).toBe(3);
  });

  it('concurrent field edits on the same node merge field by field', () => {
    const a = docWithCriteria();
    addChild(a, { parentId: 'root', node: { label: 'n', values: { cost: 1 } }, id: 'n' });
    const b = clone(a);
    rename(a, { nodeId: 'n', label: 'renamed by a' });
    setValues(b, { nodeId: 'n', values: { risk: 0.3 } });
    sync(a, b);
    const n = buildSnapshot(a).nodes['n']!;
    expect(n.label).toBe('renamed by a');
    expect(n.values).toEqual({ cost: { value: 1 }, risk: { value: 0.3 } });
    expect(buildSnapshot(b).nodes['n']).toEqual(n);
  });

  it('three clients syncing in different orders converge', () => {
    const a = docWithCriteria();
    const b = clone(a);
    const c = clone(a);
    addChild(a, { parentId: 'root', node: { label: 'a' }, id: 'a' });
    addChild(b, { parentId: 'root', node: { label: 'b' }, id: 'b' });
    addChild(c, { parentId: 'root', node: { label: 'c' }, id: 'c' });
    move(a, { nodeId: 'a', parentId: 'root', index: 0 });
    const ua = Y.encodeStateAsUpdate(a);
    const ub = Y.encodeStateAsUpdate(b);
    const uc = Y.encodeStateAsUpdate(c);
    Y.applyUpdate(a, ub);
    Y.applyUpdate(a, uc);
    Y.applyUpdate(b, uc);
    Y.applyUpdate(b, ua);
    Y.applyUpdate(c, ua);
    Y.applyUpdate(c, ub);
    expect(buildSnapshot(a)).toEqual(buildSnapshot(b));
    expect(buildSnapshot(b)).toEqual(buildSnapshot(c));
  });
});
