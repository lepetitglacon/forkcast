import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import {
  buildSnapshot,
  createDoc,
  createDocFromJson,
  docToJson,
  encodeDocState,
  executeCommand,
  newId,
  recordActivity,
  type Actor,
} from '@forkcast/doc';
import type { TreeMetaDto } from '@forkcast/shared';
import { api } from '@/lib/api';
import { bytesToBase64 } from '@/lib/utils';
import { removeRegistryEntry, touchRegistryEntry, upsertRegistryEntry, type RegistryEntry } from './registry';

export const DOC_PREFIX = 'forkcast:doc:';

export function localDocName(id: string): string {
  return `${DOC_PREFIX}${id}`;
}

export function syncedDocName(treeId: string): string {
  return `${DOC_PREFIX}s:${treeId}`;
}

/** Store the current state of a fresh document under `name`, then release the database. */
async function persistNewDoc(doc: Y.Doc, name: string): Promise<void> {
  const persistence = new IndexeddbPersistence(name, doc);
  await persistence.whenSynced;
  await persistence.destroy();
}

/** Open a persisted document, run `fn` with it and release it. */
export async function withLocalDoc<T>(id: string, fn: (doc: Y.Doc) => T | Promise<T>): Promise<T> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(localDocName(id), doc);
  await persistence.whenSynced;
  try {
    return await fn(doc);
  } finally {
    await persistence.destroy();
    doc.destroy();
  }
}

export function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error(`Suppression de ${name} impossible`));
    req.onblocked = () => resolve();
  });
}

export interface CreateLocalTreeInput {
  title?: string;
  /** Tree JSON (validated by the doc layer; throws a DocError when invalid). */
  json?: unknown;
  /** Author recorded in the history (as an import when the tree comes from JSON). */
  actor?: Actor;
  /** History summary of the creation, e.g. "Arbre importé depuis un fichier JSON". */
  summary?: string;
}

/** Create a new local tree (empty or from JSON), persist it and register it. */
export async function createLocalTree(input: CreateLocalTreeInput = {}): Promise<RegistryEntry> {
  const doc =
    input.json !== undefined
      ? createDocFromJson(input.json, input.title !== undefined ? { title: input.title } : {})
      : createDoc({ title: input.title ?? 'Nouvel arbre' });
  if (input.actor) {
    const rootId = buildSnapshot(doc).meta.rootId;
    recordActivity(
      doc,
      {
        ...input.actor,
        actor: input.json !== undefined ? 'import' : input.actor.actor,
        summary: input.summary ?? (input.json !== undefined ? 'Arbre importé' : 'Arbre créé'),
        nodeIds: rootId ? [rootId] : [],
        coalesce: false,
      },
      'import',
    );
  }
  const id = newId();
  const title = buildSnapshot(doc).meta.title || 'Sans titre';
  await persistNewDoc(doc, localDocName(id));
  doc.destroy();
  const entry: RegistryEntry = { id, title, updatedAt: Date.now() };
  upsertRegistryEntry(entry);
  return entry;
}

export async function duplicateLocalTree(id: string, actor?: Actor): Promise<RegistryEntry> {
  const json = await withLocalDoc(id, (doc) => docToJson(doc));
  const title = `${json.title || 'Sans titre'} (copie)`;
  return createLocalTree({ json, title, ...(actor ? { actor, summary: `Copie de « ${json.title || 'Sans titre'} »` } : {}) });
}

export async function renameLocalTree(id: string, title: string, actor?: Actor): Promise<void> {
  await withLocalDoc(id, (doc) => {
    executeCommand(doc, { type: 'setTitle', title }, { origin: 'local', ...(actor ? { actor } : {}) });
  });
  touchRegistryEntry(id, { title, updatedAt: Date.now() });
}

export async function deleteLocalTree(id: string): Promise<void> {
  removeRegistryEntry(id);
  await deleteDatabase(localDocName(id));
}

export async function exportLocalTreeJson(id: string): Promise<ReturnType<typeof docToJson>> {
  return withLocalDoc(id, (doc) => docToJson(doc));
}

export async function readLocalDocState(id: string): Promise<Uint8Array> {
  return withLocalDoc(id, (doc) => encodeDocState(doc));
}

/** Remove the local cache of a synced tree (after leaving it, or to free space). */
export async function deleteSyncedCache(treeId: string): Promise<void> {
  await deleteDatabase(syncedDocName(treeId));
}

/** Create a synced tree on the server from a local document state (requires a session). */
export function publishTree(title: string, state: Uint8Array): Promise<TreeMetaDto> {
  return api.post<TreeMetaDto>('/api/trees', { title: title || 'Sans titre', initialState: bytesToBase64(state) });
}
