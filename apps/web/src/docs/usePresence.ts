import { useCallback, useSyncExternalStore } from 'react';
import type { Awareness } from 'y-protocols/awareness';

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}

export interface PresenceState {
  clientId: number;
  user: PresenceUser;
  selection: string | null;
  cursor: { x: number; y: number } | null;
}

const EMPTY: PresenceState[] = [];

interface PresenceStore {
  states: PresenceState[];
  dirty: boolean;
  listeners: Set<() => void>;
}

const stores = new WeakMap<Awareness, PresenceStore>();

interface ChangeEvent {
  added: number[];
  updated: number[];
  removed: number[];
}

function storeFor(awareness: Awareness): PresenceStore {
  let store = stores.get(awareness);
  if (!store) {
    const created: PresenceStore = { states: EMPTY, dirty: true, listeners: new Set() };
    awareness.on('change', ({ added, updated, removed }: ChangeEvent) => {
      // Our own cursor/selection updates (up to 25 per second) must not re-render the editor.
      const self = awareness.clientID;
      if ([...added, ...updated, ...removed].every((id) => id === self)) return;
      created.dirty = true;
      for (const l of created.listeners) l();
    });
    stores.set(awareness, created);
    store = created;
  }
  return store;
}

function isUser(v: unknown): v is PresenceUser {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as PresenceUser).name === 'string' &&
    typeof (v as PresenceUser).color === 'string'
  );
}

function samePresence(a: readonly PresenceState[], b: readonly PresenceState[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i]!;
    return (
      p.clientId === q.clientId &&
      p.selection === q.selection &&
      p.user.id === q.user.id &&
      p.user.name === q.user.name &&
      p.user.color === q.user.color &&
      p.cursor?.x === q.cursor?.x &&
      p.cursor?.y === q.cursor?.y
    );
  });
}

function read(awareness: Awareness): PresenceState[] {
  const store = storeFor(awareness);
  if (!store.dirty) return store.states;
  const out: PresenceState[] = [];
  awareness.getStates().forEach((raw, clientId) => {
    if (clientId === awareness.clientID) return;
    const state = raw as Record<string, unknown>;
    if (!isUser(state.user)) return;
    const cursor = state.cursor as { x?: unknown; y?: unknown } | null | undefined;
    out.push({
      clientId,
      user: { id: String(state.user.id ?? clientId), name: state.user.name, color: state.user.color },
      selection: typeof state.selection === 'string' ? state.selection : null,
      cursor:
        cursor && typeof cursor.x === 'number' && typeof cursor.y === 'number' ? { x: cursor.x, y: cursor.y } : null,
    });
  });
  out.sort((a, b) => a.clientId - b.clientId);
  if (out.length === 0) store.states = EMPTY;
  else if (!samePresence(out, store.states)) store.states = out;
  store.dirty = false;
  return store.states;
}

/** Other participants (presence), excluding the local client. */
export function usePresence(awareness: Awareness | null): PresenceState[] {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!awareness) return () => {};
      const store = storeFor(awareness);
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    [awareness],
  );
  const getSnapshot = useCallback(() => (awareness ? read(awareness) : EMPTY), [awareness]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Selections of the others only (stable while only cursors move). */
export function selectionKey(presence: readonly PresenceState[]): string {
  return presence.map((p) => `${p.clientId}:${p.selection ?? ''}:${p.user.color}:${p.user.name}`).join('|');
}
