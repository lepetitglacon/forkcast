import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import { createUndoManager } from '@forkcast/doc';

export interface UndoApi {
  manager: Y.UndoManager;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/** Undo/redo of local changes only (remote and assistant changes are never undone). */
export function useUndoManager(doc: Y.Doc): UndoApi {
  const [manager] = useState(() => createUndoManager(doc));

  useEffect(() => () => manager.destroy(), [manager]);

  const subscribe = useCallback(
    (listener: () => void) => {
      const events = ['stack-item-added', 'stack-item-popped', 'stack-cleared', 'stack-item-updated'] as const;
      for (const e of events) manager.on(e, listener);
      return () => {
        for (const e of events) manager.off(e, listener);
      };
    },
    [manager],
  );
  const canUndo = useSyncExternalStore(subscribe, () => manager.undoStack.length > 0);
  const canRedo = useSyncExternalStore(subscribe, () => manager.redoStack.length > 0);
  const undo = useCallback(() => {
    manager.undo();
  }, [manager]);
  const redo = useCallback(() => {
    manager.redo();
  }, [manager]);

  return { manager, canUndo, canRedo, undo, redo };
}
