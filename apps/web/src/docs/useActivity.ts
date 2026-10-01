import { useCallback, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import { ActivityEntrySchema, type ActivityEntry } from '@forkcast/shared';
import { getActivity } from '@forkcast/doc';

interface ActivityStore {
  entries: ActivityEntry[];
  dirty: boolean;
  listeners: Set<() => void>;
}

const stores = new WeakMap<Y.Doc, ActivityStore>();
/**
 * Validation result per raw entry object. Y.Array hands out the same object for an
 * unchanged item, so with up to 10 000 entries only new ones are validated.
 */
const validity = new WeakMap<object, boolean>();

function isValid(raw: unknown): raw is ActivityEntry {
  if (typeof raw !== 'object' || raw === null) return false;
  let ok = validity.get(raw);
  if (ok === undefined) {
    ok = ActivityEntrySchema.safeParse(raw).success;
    validity.set(raw, ok);
  }
  return ok;
}

export function readActivity(doc: Y.Doc): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  for (const raw of getActivity(doc).toArray() as unknown[]) if (isValid(raw)) out.push(raw);
  return out;
}

function storeFor(doc: Y.Doc): ActivityStore {
  let store = stores.get(doc);
  if (!store) {
    const created: ActivityStore = { entries: [], dirty: true, listeners: new Set() };
    getActivity(doc).observe(() => {
      created.dirty = true;
      for (const l of created.listeners) l();
    });
    stores.set(doc, created);
    store = created;
  }
  return store;
}

function read(doc: Y.Doc): ActivityEntry[] {
  const store = storeFor(doc);
  if (store.dirty) {
    store.entries = readActivity(doc);
    store.dirty = false;
  }
  return store.entries;
}

/** Shared history of the document (oldest first), refreshed when the shared array changes. */
export function useActivity(doc: Y.Doc): ActivityEntry[] {
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
  const getSnapshot = useCallback(() => read(doc), [doc]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
