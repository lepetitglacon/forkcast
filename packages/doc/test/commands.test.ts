import { describe, expect, it } from 'vitest';
import {
  addChild,
  addCriterion,
  addSibling,
  addSubtree,
  applyCommand,
  applyCommands,
  buildSnapshot,
  DocError,
  move,
  remove,
  removeCriterion,
  rename,
  setKind,
  setNotes,
  setOptional,
  setTitle,
  setValues,
  updateCriterion,
} from '../src';
import type { Command } from '@forkcast/shared';
import { docWithCriteria, snap } from './helpers';

function expectCode(fn: () => unknown, code: DocError['code']): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DocError);
    expect((e as DocError).code).toBe(code);
    return;
  }
  throw new Error(`expected DocError ${code}`);
}

/** Apply a command, then its inverse, and check the document is back to its initial state. */
function roundTrip(doc: ReturnType<typeof docWithCriteria>, run: () => { inverse: Command[] }): void {
  const before = snap(doc);
  const { inverse } = run();
  expect(snap(doc)).not.toEqual(before);
  for (const cmd of inverse) applyCommand(doc, cmd);
  expect(snap(doc)).toEqual(before);
}

describe('node commands', () => {
  it('addChild / addSibling keep order and promote leaves to AND', () => {
    const doc = docWithCriteria();
    const a = addChild(doc, { parentId: 'root', node: { label: 'a' }, id: 'a' });
    expect(a.result.id).toBe('a');
    const b = addChild(doc, { parentId: 'root', node: { label: 'b', values: { cost: 3 } }, id: 'b' });
    const c = addChild(doc, { parentId: 'root', node: { label: 'c' }, id: 'c', position: 'first' });
    addSibling(doc, { siblingId: b.result.id, node: { label: 'd' }, id: 'd' });
    addSibling(doc, { siblingId: 'a', node: { label: 'e' }, id: 'e', where: 'before' });
    expect(buildSnapshot(doc).children['root']).toEqual([c.result.id, 'e', 'a', 'b', 'd']);
    expect(buildSnapshot(doc).nodes['b']!.values).toEqual({ cost: { value: 3 } });

    const leafChild = addChild(doc, { parentId: 'a', node: { label: 'under a leaf' } });
    expect(buildSnapshot(doc).nodes['a']!.kind).toBe('and');
    expect(leafChild.inverse).toEqual([
      { type: 'remove', nodeId: leafChild.result.id },
      { type: 'setKind', nodeId: 'a', kind: 'leaf' },
    ]);
    for (const cmd of leafChild.inverse) applyCommand(doc, cmd);
    expect(buildSnapshot(doc).nodes['a']!.kind).toBe('leaf');
  });

  it('generates a fresh id when the requested one is taken', () => {
    const doc = docWithCriteria();
    addChild(doc, { parentId: 'root', node: { label: 'a' }, id: 'a' });
    const again = addChild(doc, { parentId: 'root', node: { label: 'a2' }, id: 'a' });
    expect(again.result.id).not.toBe('a');
  });

  it('rejects unknown parents, unknown criteria and sibling of root', () => {
    const doc = docWithCriteria();
    expectCode(() => addChild(doc, { parentId: 'nope', node: { label: 'x' } }), 'NODE_NOT_FOUND');
    expectCode(() => addChild(doc, { parentId: 'root', node: { label: 'x', values: { zz: 1 } } }), 'CRITERION_NOT_FOUND');
    expectCode(() => addSibling(doc, { siblingId: 'root', node: { label: 'x' } }), 'ROOT_IMMUTABLE');
  });

  it('addSubtree inserts a whole branch with ids kept when free, inverse removes it', () => {
    const doc = docWithCriteria();
    addChild(doc, { parentId: 'root', node: { label: 'taken' }, id: 'psp' });
    roundTrip(doc, () => {
      const r = addSubtree(
        doc,
        {
          parentId: 'root',
          subtree: {
            id: 'psp',
            label: 'PSP',
            children: [
              { id: 'stripe', label: 'Stripe', values: { cost: 25 } },
              { label: 'Adyen', values: { cost: { value: 60 } } },
            ],
          },
          estimatedBy: 'ai',
        },
        'mcp',
      );
      expect(r.result.idMap['psp']).toBe(r.result.id);
      expect(r.result.nodeIds).toHaveLength(3);
      expect(r.result.nodeIds[1]).toBe('stripe');
      const tree = buildSnapshot(doc);
      expect(tree.nodes[r.result.id]!.kind).toBe('and');
      expect(tree.nodes['stripe']!.values).toEqual({ cost: { value: 25, estimatedBy: 'ai' } });
      return r;
    });
  });

  it('move validates targets and is reversible', () => {
    const doc = docWithCriteria();
    addSubtree(doc, {
      parentId: 'root',
      subtree: { id: 'a', label: 'a', children: [{ id: 'a1', label: 'a1', children: [{ id: 'a11', label: 'a11' }] }] },
    });
    addChild(doc, { parentId: 'root', node: { label: 'b' }, id: 'b' });
    expectCode(() => move(doc, { nodeId: 'root', parentId: 'b' }), 'ROOT_IMMUTABLE');
    expectCode(() => move(doc, { nodeId: 'a', parentId: 'a' }), 'INVALID_MOVE');
    expectCode(() => move(doc, { nodeId: 'a', parentId: 'a11' }), 'INVALID_MOVE');
    expectCode(() => move(doc, { nodeId: 'a', parentId: 'zz' }), 'NODE_NOT_FOUND');
    roundTrip(doc, () => {
      const r = move(doc, { nodeId: 'a11', parentId: 'b' });
      const tree = buildSnapshot(doc);
      expect(tree.children['b']).toEqual(['a11']);
      expect(tree.nodes['b']!.kind).toBe('and');
      return r;
    });
    roundTrip(doc, () => move(doc, { nodeId: 'b', parentId: 'root', index: 0 }));
    expect(buildSnapshot(doc).children['root']).toEqual(['a', 'b']);
  });

  it('remove deletes the whole branch and restores it with the same ids and order', () => {
    const doc = docWithCriteria();
    addSubtree(doc, {
      parentId: 'root',
      subtree: { id: 'a', label: 'a', children: [{ id: 'a1', label: 'a1', values: { cost: 1 } }, { id: 'a2', label: 'a2' }] },
    });
    addChild(doc, { parentId: 'root', node: { label: 'b' }, id: 'b' });
    expectCode(() => remove(doc, { nodeId: 'root' }), 'ROOT_IMMUTABLE');
    roundTrip(doc, () => {
      const r = remove(doc, { nodeId: 'a' });
      expect(r.result.removedIds).toEqual(['a', 'a1', 'a2']);
      expect(Object.keys(buildSnapshot(doc).nodes).sort()).toEqual(['b', 'root']);
      return r;
    });
    expect(buildSnapshot(doc).children['root']).toEqual(['a', 'b']);
  });

  it('field commands are reversible and validated', () => {
    const doc = docWithCriteria();
    addChild(doc, { parentId: 'root', node: { label: 'a' }, id: 'a' });
    addChild(doc, { parentId: 'a', node: { label: 'a1' }, id: 'a1' });
    roundTrip(doc, () => rename(doc, { nodeId: 'a', label: 'renamed' }));
    roundTrip(doc, () => setNotes(doc, { nodeId: 'a', notes: 'hello' }));
    roundTrip(doc, () => setOptional(doc, { nodeId: 'a', optional: true }));
    roundTrip(doc, () => setKind(doc, { nodeId: 'a', kind: 'or' }));
    roundTrip(doc, () => setTitle(doc, 'new title'));
    expectCode(() => setKind(doc, { nodeId: 'a', kind: 'leaf' }), 'HAS_CHILDREN');
    expectCode(() => setOptional(doc, { nodeId: 'root', optional: true }), 'ROOT_IMMUTABLE');
    expectCode(() => rename(doc, { nodeId: 'zz', label: 'x' }), 'NODE_NOT_FOUND');
  });

  it('setValues sets, flags and unsets values, keeping previous flags on undo', () => {
    const doc = docWithCriteria();
    addChild(doc, { parentId: 'root', node: { label: 'a', values: { cost: 1 } }, id: 'a' });
    roundTrip(doc, () => {
      const r = setValues(doc, { nodeId: 'a', values: { cost: 5, risk: 0.2 }, estimatedBy: 'ai' }, 'mcp');
      expect(buildSnapshot(doc).nodes['a']!.values).toEqual({
        cost: { value: 5, estimatedBy: 'ai' },
        risk: { value: 0.2, estimatedBy: 'ai' },
      });
      return r;
    });
    roundTrip(doc, () => setValues(doc, { nodeId: 'a', values: { cost: null } }));
    expectCode(() => setValues(doc, { nodeId: 'a', values: { zz: 1 } }), 'CRITERION_NOT_FOUND');
  });
});

describe('criteria commands', () => {
  it('add / update / remove with inverses, slug ids and value cleanup', () => {
    const doc = docWithCriteria();
    addChild(doc, { parentId: 'root', node: { label: 'a', values: { cost: 1, risk: 0.5 } }, id: 'a' });
    roundTrip(doc, () => {
      const r = addCriterion(doc, { criterion: { label: 'Temps de dev', unit: 'j' } });
      expect(r.result.id).toBe('temps-de-dev');
      expect(r.result.criterion.order).toBe(2);
      return r;
    });
    expectCode(() => addCriterion(doc, { criterion: { id: 'cost', label: 'dup' } }), 'CRITERION_EXISTS');
    const dup = addCriterion(doc, { criterion: { label: 'Coût' } });
    expect(dup.result.id).toBe('cout');
    roundTrip(doc, () => updateCriterion(doc, { criterionId: 'cost', patch: { label: 'Cost', unit: null, direction: 'maximize' } }));
    roundTrip(doc, () => {
      const r = removeCriterion(doc, { criterionId: 'cost' });
      expect(r.result.affectedNodes).toBe(1);
      expect(buildSnapshot(doc).nodes['a']!.values).toEqual({ risk: { value: 0.5 } });
      return r;
    });
    expectCode(() => updateCriterion(doc, { criterionId: 'zz', patch: {} }), 'CRITERION_NOT_FOUND');
  });
});

describe('applyCommand / applyCommands', () => {
  it('validates the command shape', () => {
    const doc = docWithCriteria();
    expectCode(() => applyCommand(doc, { type: 'rename', nodeId: 'root' }), 'VALIDATION');
    expectCode(() => applyCommand(doc, { type: 'unknown' }), 'VALIDATION');
  });

  it('applies a batch atomically and rolls back on failure', () => {
    const doc = docWithCriteria();
    const before = snap(doc);
    expectCode(
      () =>
        applyCommands(doc, [
          { type: 'addChild', parentId: 'root', node: { label: 'ok' }, id: 'ok' },
          { type: 'setTitle', title: 'changed' },
          { type: 'rename', nodeId: 'missing', label: 'boom' },
        ]),
      'NODE_NOT_FOUND',
    );
    expect(snap(doc)).toEqual(before);

    const batch = applyCommands(doc, [
      { type: 'addChild', parentId: 'root', node: { label: 'a' }, id: 'a' },
      { type: 'addChild', parentId: 'a', node: { label: 'a1' }, id: 'a1' },
      { type: 'setValues', nodeId: 'a1', values: { cost: 2 } },
    ]);
    expect(batch.affectedNodeIds).toContain('a1');
    expect(batch.inverse[0]).toEqual({ type: 'setValues', nodeId: 'a1', values: { cost: null } });
    for (const cmd of batch.inverse) applyCommand(doc, cmd);
    expect(snap(doc)).toEqual(before);
  });
});
