import { describe, expect, it } from 'vitest';
import { analyzeTree, countConfigurations } from '@forkcast/engine';
import { TreeJsonSchema } from '@forkcast/shared';
import {
  addChild,
  buildSnapshot,
  createDoc,
  createDocFromJson,
  DocError,
  docFromState,
  docToJson,
  encodeDocState,
  exampleTreeJson,
  importJson,
  nodeToJson,
  parseTreeJson,
} from '../src';
import { snap } from './helpers';

describe('JSON import / export', () => {
  it('round-trips the example tree', () => {
    const json = exampleTreeJson();
    expect(TreeJsonSchema.safeParse(json).success).toBe(true);
    const doc = createDocFromJson(json);
    const tree = buildSnapshot(doc);
    expect(tree.meta.rootId).toBe('root');
    expect(tree.criteria.map((c) => c.id)).toEqual(['cost', 'dev', 'risk']);
    expect(countConfigurations(tree)).toBe(4 * 2 * 2 * 2);
    const exported = docToJson(doc);
    expect(exported).toEqual({ ...json, root: expect.anything() });
    const again = createDocFromJson(exported);
    expect(snap(again)).toEqual(snap(doc));
    const analysis = analyzeTree(tree);
    expect(analysis.enumerated).toBe(true);
    expect(analysis.pareto.length).toBeGreaterThan(0);
  });

  it('keeps or regenerates ids and flags imported values', () => {
    const json = exampleTreeJson();
    const fresh = createDocFromJson(json, { keepIds: false, estimatedBy: 'ai', title: 'Copy' });
    const tree = buildSnapshot(fresh);
    expect(tree.meta.title).toBe('Copy');
    expect(tree.nodes['root']).toBeUndefined();
    expect(Object.keys(tree.nodes)).toHaveLength(17);
    const anyLeaf = Object.values(tree.nodes).find((n) => n.label === 'Stripe')!;
    expect(anyLeaf.values['cost']).toEqual({ value: 25, estimatedBy: 'ai' });
  });

  it('exports bare numbers unless a value is flagged', () => {
    const doc = createDoc({ rootId: 'r', title: 'x' });
    importJson(doc, {
      format: 'forkcast-tree',
      version: 1,
      title: 'x',
      criteria: [{ label: 'Coût mensuel' }],
      root: { id: 'r', label: 'r', children: [{ id: 'a', label: 'a', values: { 'cout-mensuel': { value: 2, estimatedBy: 'ai' } } }, { id: 'b', label: 'b', values: { 'cout-mensuel': 3 } }] },
    });
    const tree = buildSnapshot(doc);
    expect(nodeToJson(tree, 'a').values).toEqual({ 'cout-mensuel': { value: 2, estimatedBy: 'ai' } });
    expect(nodeToJson(tree, 'b').values).toEqual({ 'cout-mensuel': 3 });
    expect(nodeToJson(tree, 'b').children).toBeUndefined();
  });

  it('rejects invalid JSON and unknown criteria with typed errors', () => {
    expect(() => parseTreeJson({ format: 'nope' })).toThrowError(DocError);
    try {
      createDocFromJson({ format: 'forkcast-tree', version: 1, title: 't', criteria: [], root: { label: 'r', children: [{ label: 'c', values: { cost: 1 } }] } });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as DocError).code).toBe('CRITERION_NOT_FOUND');
      expect((e as DocError).message).toContain('root.children[0]');
    }
  });

  it('replaces the previous content on import', () => {
    const doc = createDoc({ rootId: 'old' });
    addChild(doc, { parentId: 'old', node: { label: 'gone' }, id: 'gone' });
    importJson(doc, exampleTreeJson());
    const tree = buildSnapshot(doc);
    expect(tree.nodes['gone']).toBeUndefined();
    expect(tree.nodes['old']).toBeUndefined();
    expect(tree.meta.rootId).toBe('root');
  });

  it('encodes and decodes binary state', () => {
    const doc = createDocFromJson(exampleTreeJson());
    const copy = docFromState(encodeDocState(doc));
    expect(snap(copy)).toEqual(snap(doc));
  });
});
