import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { HocuspocusProvider, type AuthorizedScope } from '@hocuspocus/provider';
import { migrateDoc } from '@forkcast/doc';
import { getToken } from '@/lib/token';
import { syncedDocName } from './localDocs';

export type SyncStatus = 'connecting' | 'connected' | 'disconnected';

export interface SyncedDocState {
  treeId: string;
  doc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  /** Local IndexedDB cache applied. */
  localSynced: boolean;
  /** First handshake with the server completed. */
  serverSynced: boolean;
  status: SyncStatus;
  unsyncedChanges: number;
  scope: AuthorizedScope | null;
  authError: string | null;
}

export function collabUrl(): string {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured;
  return `${window.location.origin.replace(/^http/, 'ws')}/collab`;
}

function initialState(treeId: string): SyncedDocState {
  return {
    treeId,
    doc: null,
    provider: null,
    localSynced: false,
    serverSynced: false,
    status: 'connecting',
    unsyncedChanges: 0,
    scope: null,
    authError: null,
  };
}

/**
 * Open a synced tree: Y.Doc cached locally (y-indexeddb) and connected to the
 * collaboration server (Hocuspocus). Works offline from the cache and merges on reconnect.
 */
export function useSyncedDoc(treeId: string): SyncedDocState {
  const [state, setState] = useState<SyncedDocState>(() => initialState(treeId));

  useEffect(() => {
    if (!treeId) return;
    const doc = new Y.Doc();
    const persistence = new IndexeddbPersistence(syncedDocName(treeId), doc);
    let provider: HocuspocusProvider | null = null;
    let disposed = false;

    const patch = (p: Partial<SyncedDocState>) =>
      setState((prev) => (prev.treeId === treeId ? { ...prev, ...p } : { ...initialState(treeId), ...p }));

    persistence.whenSynced.then(() => {
      if (disposed) return;
      try {
        migrateDoc(doc);
      } catch {
        // an unsupported version is reported by the editor when the snapshot is read
      }
      provider = new HocuspocusProvider({
        url: collabUrl(),
        name: treeId,
        document: doc,
        token: () => getToken() ?? '',
        onStatus: ({ status }) => patch({ status }),
        onSynced: ({ state: synced }) => patch({ serverSynced: synced }),
        onAuthenticated: ({ scope }) => patch({ scope, authError: null }),
        onAuthenticationFailed: ({ reason }) => patch({ authError: reason || 'Accès refusé' }),
        onUnsyncedChanges: ({ number }) => patch({ unsyncedChanges: number }),
      });
      patch({ doc, provider, localSynced: true, treeId });
    });

    return () => {
      disposed = true;
      provider?.destroy();
      void persistence.destroy();
      doc.destroy();
    };
  }, [treeId]);

  return state.treeId === treeId ? state : initialState(treeId);
}
