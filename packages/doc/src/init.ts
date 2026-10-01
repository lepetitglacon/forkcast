import * as Y from 'yjs';
import { newId } from './ids';
import { generateKeyBetween } from './order';
import { getMeta, getNodes, SCHEMA_VERSION, type Origin } from './schema';
import { makeNodeMap } from './nodes';

export interface InitOptions {
  title?: string;
  rootId?: string;
  rootLabel?: string;
}

export function isInitialized(doc: Y.Doc): boolean {
  const rootId = getMeta(doc).get('rootId');
  return typeof rootId === 'string' && getNodes(doc).has(rootId);
}

/** Create meta + root node. Idempotent: returns the existing root id when already initialized. */
export function initDoc(doc: Y.Doc, options: InitOptions = {}, origin: Origin = 'local'): string {
  if (isInitialized(doc)) return getMeta(doc).get('rootId') as string;
  const title = options.title ?? 'Nouvel arbre';
  const rootId = options.rootId ?? newId();
  doc.transact(() => {
    const meta = getMeta(doc);
    meta.set('schemaVersion', SCHEMA_VERSION);
    meta.set('title', title);
    meta.set('rootId', rootId);
    getNodes(doc).set(
      rootId,
      makeNodeMap({
        id: rootId,
        parentId: null,
        orderKey: generateKeyBetween(null, null),
        label: options.rootLabel ?? title,
        kind: 'and',
        values: {},
      }),
    );
  }, origin);
  return rootId;
}

export function createDoc(options: InitOptions = {}, origin: Origin = 'local'): Y.Doc {
  const doc = new Y.Doc();
  initDoc(doc, options, origin);
  return doc;
}

export function ensureInitialized(doc: Y.Doc, options: InitOptions = {}, origin: Origin = 'system'): string {
  return initDoc(doc, options, origin);
}
