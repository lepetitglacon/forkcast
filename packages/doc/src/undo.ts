import * as Y from 'yjs';
import { getCriteria, getMeta, getNodes } from './schema';

export interface UndoOptions {
  /** Transaction origins to track (default: only `local`). */
  trackedOrigins?: Iterable<unknown>;
  /** Changes closer than this (ms) are merged into one undo step (default 400). */
  captureTimeout?: number;
}

/**
 * Undo manager limited to local transactions: remote and assistant changes are never
 * undone by Ctrl+Z (assistant changes are reverted through the activity log instead).
 */
export function createUndoManager(doc: Y.Doc, options: UndoOptions = {}): Y.UndoManager {
  return new Y.UndoManager([getNodes(doc), getCriteria(doc), getMeta(doc)], {
    trackedOrigins: new Set(options.trackedOrigins ?? ['local']),
    captureTimeout: options.captureTimeout ?? 400,
  });
}
