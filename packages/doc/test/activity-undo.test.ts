import { describe, expect, it } from 'vitest';
import { ACTIVITY_LOG_LIMIT } from '@forkcast/shared';
import {
  addSubtree,
  buildSnapshot,
  createUndoManager,
  getSchemaVersion,
  listActivity,
  migrateDoc,
  recordActivity,
  rename,
  revertActivity,
  setValues,
  getMeta,
} from '../src';
import { docWithCriteria, snap } from './helpers';

describe('activity log', () => {
  it('records assistant changes and reverts them through their inverse', () => {
    const doc = docWithCriteria();
    const before = snap(doc);
    const r = addSubtree(doc, { parentId: 'root', subtree: { label: 'AI branch', children: [{ label: 'x', values: { cost: 1 } }] }, estimatedBy: 'ai' }, 'mcp');
    const entry = recordActivity(doc, { actor: 'ai', tool: 'build_subtree', summary: 'Added "AI branch"', nodeIds: r.affectedNodeIds, inverse: r.inverse });
    expect(listActivity(doc)).toHaveLength(1);
    expect(listActivity(doc)[0]!.id).toBe(entry.id);
    const reverted = revertActivity(doc, entry.id);
    expect(reverted.entry.id).toBe(entry.id);
    expect(snap(doc)).toEqual(before);
    expect(listActivity(doc)[0]!.reverted).toBe(true);
    expect(() => revertActivity(doc, entry.id)).toThrow(/already reverted/);
    expect(() => revertActivity(doc, 'nope')).toThrow(/not found/);
  });

  it('prunes the log', () => {
    const doc = docWithCriteria();
    for (let i = 0; i < ACTIVITY_LOG_LIMIT + 7; i++) {
      recordActivity(doc, { actor: 'ai', summary: `#${i}`, nodeIds: [], inverse: [] });
    }
    const entries = listActivity(doc);
    expect(entries).toHaveLength(ACTIVITY_LOG_LIMIT);
    expect(entries[0]!.summary).toBe('#7');
  });
});

describe('undo manager', () => {
  it('undoes local transactions only', () => {
    const doc = docWithCriteria();
    const r = addSubtree(doc, { parentId: 'root', subtree: { id: 'n', label: 'n', values: { cost: 1 } } }, 'import');
    const undo = createUndoManager(doc, { captureTimeout: 0 });
    rename(doc, { nodeId: r.result.id, label: 'local rename' }, 'local');
    undo.stopCapturing();
    setValues(doc, { nodeId: r.result.id, values: { cost: 99 } }, 'mcp');
    undo.stopCapturing();
    rename(doc, { nodeId: r.result.id, label: 'second local rename' }, 'local');
    expect(undo.undoStack).toHaveLength(2);
    undo.undo();
    expect(buildSnapshot(doc).nodes['n']!.label).toBe('local rename');
    undo.undo();
    expect(buildSnapshot(doc).nodes['n']!.label).toBe('n');
    // the assistant value stays
    expect(buildSnapshot(doc).nodes['n']!.values['cost']).toEqual({ value: 99 });
    expect(undo.undoStack).toHaveLength(0);
    undo.redo();
    expect(buildSnapshot(doc).nodes['n']!.label).toBe('local rename');
  });
});

describe('migrations', () => {
  it('sets the version when missing and is a no-op when current', () => {
    const doc = docWithCriteria();
    getMeta(doc).delete('schemaVersion');
    expect(getSchemaVersion(doc)).toBeUndefined();
    expect(migrateDoc(doc)).toEqual({ from: 1, to: 1, applied: [] });
    expect(getSchemaVersion(doc)).toBe(1);
    expect(migrateDoc(doc).applied).toEqual([]);
  });

  it('refuses documents from the future', () => {
    const doc = docWithCriteria();
    getMeta(doc).set('schemaVersion', 99);
    expect(() => migrateDoc(doc)).toThrow(/newer/);
  });
});

describe('executeCommand / history of every author', () => {
  const alice = { actor: 'user' as const, actorId: 'u-alice', actorLabel: 'Alice', color: '#f00' };

  it('applies a command and records a readable entry with the author', async () => {
    const { executeCommand, listActivity, buildSnapshot, activityForNode } = await import('../src');
    const doc = docWithCriteria();
    const r = executeCommand<{ id: string }>(doc, { type: 'addChild', parentId: 'root', node: { label: 'Stripe' }, id: 'stripe' }, { actor: alice });
    expect(r.result.id).toBe('stripe');
    expect(buildSnapshot(doc).nodes['stripe']).toBeDefined();
    expect(r.entry).toMatchObject({ actor: 'user', actorId: 'u-alice', actorLabel: 'Alice', command: 'addChild', summary: 'Ajout de « Stripe » sous « Root »' });
    expect(r.entry!.inverse).toBeUndefined();
    executeCommand(doc, { type: 'setValues', nodeId: 'stripe', values: { cost: 25 } }, { actor: alice });
    const entries = listActivity(doc);
    expect(entries.map((e) => e.summary)).toEqual(['Ajout de « Stripe » sous « Root »', 'Valeurs de « Stripe » : Coût = 25']);
    expect(activityForNode(entries, 'stripe')).toHaveLength(2);
    expect(activityForNode(entries, 'root')).toHaveLength(1);
  });

  it('coalesces repeated edits of the same thing by the same author', async () => {
    const { executeCommand, listActivity } = await import('../src');
    const doc = docWithCriteria();
    executeCommand(doc, { type: 'addChild', parentId: 'root', node: { label: 'a' }, id: 'a' }, { actor: alice });
    executeCommand(doc, { type: 'setValues', nodeId: 'a', values: { cost: 1 } }, { actor: alice });
    executeCommand(doc, { type: 'setValues', nodeId: 'a', values: { cost: 2 } }, { actor: alice });
    executeCommand(doc, { type: 'setValues', nodeId: 'a', values: { cost: 3 } }, { actor: { ...alice, actorId: 'u-bob', actorLabel: 'Bob' } });
    const entries = listActivity(doc);
    expect(entries.map((e) => `${e.actorLabel}: ${e.summary}`)).toEqual([
      'Alice: Ajout de « a » sous « Root »',
      'Alice: Valeurs de « a » : Coût = 2',
      'Bob: Valeurs de « a » : Coût = 3',
    ]);
  });

  it('keeps inverses for assistant entries, and logs reverts', async () => {
    const { executeCommand, listActivity, revertActivity, buildSnapshot, canRevertActivity } = await import('../src');
    const doc = docWithCriteria();
    const r = executeCommand(doc, { type: 'addChild', parentId: 'root', node: { label: 'AI' }, id: 'ai' }, { origin: 'mcp', actor: { actor: 'ai', actorLabel: 'Claude', tool: 'add_node' } });
    expect(canRevertActivity(r.entry!)).toBe(true);
    revertActivity(doc, r.entry!.id, 'local', alice);
    expect(buildSnapshot(doc).nodes['ai']).toBeUndefined();
    const entries = listActivity(doc);
    expect(entries[0]!.reverted).toBe(true);
    expect(entries[1]).toMatchObject({ actorLabel: 'Alice', summary: 'Annulation : Ajout de « AI » sous « Root »' });
    expect(canRevertActivity(entries[1]!)).toBe(false);
  });

  it('undo of a local command leaves the history intact', async () => {
    const { executeCommand, listActivity, buildSnapshot, createUndoManager } = await import('../src');
    const doc = docWithCriteria();
    const undo = createUndoManager(doc, { captureTimeout: 0 });
    executeCommand(doc, { type: 'addChild', parentId: 'root', node: { label: 'x' }, id: 'x' }, { actor: alice });
    undo.undo();
    expect(buildSnapshot(doc).nodes['x']).toBeUndefined();
    expect(listActivity(doc)).toHaveLength(1);
  });
});
