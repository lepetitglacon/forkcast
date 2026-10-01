import { useCallback, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import type { Tree } from '@forkcast/shared';
import { buildSnapshot, EMPTY_TREE } from '@forkcast/doc';

interface SnapshotStore {
  tree: Tree;
  dirty: boolean;
  listeners: Set<() => void>;
}

const stores = new WeakMap<Y.Doc, SnapshotStore>();

function storeFor(doc: Y.Doc): SnapshotStore {
  let store = stores.get(doc);
  if (!store) {
    const created: SnapshotStore = { tree: EMPTY_TREE, dirty: true, listeners: new Set() };
    doc.on('update', () => {
      created.dirty = true;
      for (const l of created.listeners) l();
    });
    stores.set(doc, created);
    store = created;
  }
  return store;
}

/** Current snapshot of the document (rebuilt lazily after each update). */
export function readSnapshot(doc: Y.Doc): Tree {
  const store = storeFor(doc);
  if (store.dirty) {
    store.tree = buildSnapshot(doc);
    store.dirty = false;
  }
  return store.tree;
}

/** Immutable `Tree` snapshot of a Y.Doc, refreshed on every document update. */
export function useSnapshot(doc: Y.Doc): Tree {
  const subscribe = useCallback(
    (listener: () => void) => {
      const store = storeFor(doc);
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    [doc],
  );
  const getSnapshot = useCallback(() => readSnapshot(doc), [doc]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
