import * as Y from 'yjs';
import { buildSnapshot, createDoc, importJson } from '../src';
import type { Tree } from '@forkcast/shared';

export function sync(a: Y.Doc, b: Y.Doc): void {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
}

export function clone(doc: Y.Doc): Y.Doc {
  const copy = new Y.Doc();
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc));
  return copy;
}

/** Structural view of a snapshot, ignoring order keys. */
export function shape(tree: Tree, nodeId = tree.meta.rootId): unknown {
  const n = tree.nodes[nodeId]!;
  return {
    id: n.id,
    label: n.label,
    kind: n.kind,
    optional: n.optional ?? false,
    notes: n.notes ?? null,
    values: n.values,
    children: (tree.children[nodeId] ?? []).map((c) => shape(tree, c)),
  };
}

export function snap(doc: Y.Doc): unknown {
  const tree = buildSnapshot(doc);
  return { title: tree.meta.title, criteria: tree.criteria, tree: shape(tree) };
}

export function docWithCriteria(): Y.Doc {
  const doc = createDoc({ title: 'T', rootId: 'root' });
  importJson(doc, {
    format: 'forkcast-tree',
    version: 1,
    title: 'T',
    criteria: [
      { id: 'cost', label: 'Coût', unit: '€' },
      { id: 'risk', label: 'Risque', aggregation: 'probOr' },
    ],
    root: { id: 'root', label: 'Root', kind: 'and', children: [] },
  });
  return doc;
}
