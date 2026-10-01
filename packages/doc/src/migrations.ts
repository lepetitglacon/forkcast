import type * as Y from 'yjs';
import { DocError } from './errors';
import { isInitialized } from './init';
import { getMeta, SCHEMA_VERSION, type Origin } from './schema';

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;

type Migration = (doc: Y.Doc) => void;

/** Migrations keyed by the version they upgrade FROM (1 → 2 lives under key 1). */
const MIGRATIONS: Record<number, Migration> = {};

export function getSchemaVersion(doc: Y.Doc): number | undefined {
  const v = getMeta(doc).get('schemaVersion');
  return typeof v === 'number' ? v : undefined;
}

export interface MigrationResult {
  from: number;
  to: number;
  applied: number[];
}

/** Bring a document to the current schema version (no-op when already current). */
export function migrateDoc(doc: Y.Doc, origin: Origin = 'system'): MigrationResult {
  if (!isInitialized(doc)) return { from: CURRENT_SCHEMA_VERSION, to: CURRENT_SCHEMA_VERSION, applied: [] };
  const from = getSchemaVersion(doc) ?? 1;
  if (from > CURRENT_SCHEMA_VERSION) {
    throw new DocError('UNSUPPORTED_VERSION', `Document schema version ${from} is newer than supported (${CURRENT_SCHEMA_VERSION}).`, { from });
  }
  const applied: number[] = [];
  doc.transact(() => {
    let v = from;
    while (v < CURRENT_SCHEMA_VERSION) {
      const migration = MIGRATIONS[v];
      if (!migration) throw new DocError('UNSUPPORTED_VERSION', `No migration from schema version ${v}.`, { from: v });
      migration(doc);
      applied.push(v);
      v++;
    }
    if (getSchemaVersion(doc) !== CURRENT_SCHEMA_VERSION) getMeta(doc).set('schemaVersion', CURRENT_SCHEMA_VERSION);
  }, origin);
  return { from, to: CURRENT_SCHEMA_VERSION, applied };
}
