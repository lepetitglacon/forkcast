import { createContext, useContext } from 'react';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import type { Command, Tree } from '@forkcast/shared';
import type { Actor, ExecuteBatchResult, ExecuteResult } from '@forkcast/doc';
import type { UndoApi } from './useUndoManager';

export interface DocWriter {
  /** Apply one command, logged in the history with the current author (null on error/read-only). */
  exec: <T = unknown>(command: Command, options?: { summary?: string }) => ExecuteResult<T> | null;
  /** Apply several commands atomically, logged as ONE history entry. */
  execMany: (commands: Command[], summary: string) => ExecuteBatchResult | null;
  /** Revert a history entry (assistant changes), logged as "Annulation : …". */
  revert: (entryId: string) => boolean;
  /** Run any other document operation with the same error handling (toasts). */
  guard: <T>(fn: () => T) => T | undefined;
}

export interface DocContextValue extends DocWriter {
  doc: Y.Doc;
  tree: Tree;
  /** `local:<id>` or `synced:<treeId>`; keys the per-tree view state. */
  treeKey: string;
  /** Server tree id for synced trees. */
  treeId: string | null;
  /** Local registry id for local trees. */
  localId: string | null;
  readOnly: boolean;
  actor: Actor;
  undo: UndoApi;
  awareness: Awareness | null;
}

export const DocContext = createContext<DocContextValue | null>(null);

export function useDocContext(): DocContextValue {
  const ctx = useContext(DocContext);
  if (!ctx) throw new Error('useDocContext doit être utilisé dans un éditeur');
  return ctx;
}
