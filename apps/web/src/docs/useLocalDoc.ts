import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { getMeta, initDoc, isInitialized, migrateDoc } from '@forkcast/doc';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { localDocName } from './localDocs';
import { readRegistry, touchRegistryEntry } from './registry';

export interface LocalDocState {
  doc: Y.Doc | null;
  ready: boolean;
}

/**
 * Open a local tree: Y.Doc persisted with y-indexeddb. The document is handed out only
 * once the stored updates are applied; an empty document is initialized on the fly.
 */
export function useLocalDoc(id: string): LocalDocState {
  const [state, setState] = useState<{ id: string; doc: Y.Doc } | null>(null);

  useEffect(() => {
    if (!id) return;
    const doc = new Y.Doc();
    const persistence = new IndexeddbPersistence(localDocName(id), doc);
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const touch = () => {
      timer = null;
      const title = getMeta(doc).get('title');
      touchRegistryEntry(id, {
        title: typeof title === 'string' && title.length > 0 ? title : 'Sans titre',
        updatedAt: Date.now(),
      });
    };
    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === persistence) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(touch, 500);
    };

    persistence.whenSynced.then(() => {
      if (disposed) return;
      if (!isInitialized(doc)) {
        const title = readRegistry().find((e) => e.id === id)?.title ?? 'Nouvel arbre';
        initDoc(doc, { title }, 'system');
      }
      try {
        migrateDoc(doc);
      } catch (error) {
        toast.error(errorMessage(error));
      }
      doc.on('update', onUpdate);
      setState({ id, doc });
    });

    return () => {
      disposed = true;
      if (timer !== null) {
        clearTimeout(timer);
        touch();
      }
      doc.off('update', onUpdate);
      void persistence.destroy();
      doc.destroy();
    };
  }, [id]);

  return state !== null && state.id === id ? { doc: state.doc, ready: true } : { doc: null, ready: false };
}
