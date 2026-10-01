import { useMemo } from 'react';
import type * as Y from 'yjs';
import type { Command } from '@forkcast/shared';
import { executeCommand, executeCommands, revertActivity, type Actor } from '@forkcast/doc';
import { toast } from 'sonner';
import { describeError } from '@/lib/errors';
import type { DocWriter } from './DocContext';

function notifyError(error: unknown): void {
  const { title, description } = describeError(error);
  toast.error(title, description ? { description } : undefined);
}

/**
 * Every write of the UI goes through here: one serializable command (or a batch), applied
 * with origin `local` (undoable) and recorded in the shared history with the current author.
 */
export function useDocWriter(doc: Y.Doc, manager: Y.UndoManager, actor: Actor, readOnly: boolean): DocWriter {
  return useMemo<DocWriter>(() => {
    const guard = <T,>(fn: () => T): T | undefined => {
      if (readOnly) {
        toast.error('Lecture seule', { description: 'Vous n’avez pas le droit de modifier cet arbre.' });
        return undefined;
      }
      manager.stopCapturing();
      try {
        return fn();
      } catch (error) {
        notifyError(error);
        return undefined;
      }
    };
    return {
      guard,
      exec: <T,>(command: Command, options?: { summary?: string }) =>
        guard(() =>
          executeCommand<T>(doc, command, {
            origin: 'local',
            actor,
            ...(options?.summary ? { summary: options.summary } : {}),
          }),
        ) ?? null,
      execMany: (commands, summary) =>
        commands.length === 0 ? null : (guard(() => executeCommands(doc, commands, { origin: 'local', actor, summary })) ?? null),
      revert: (entryId) => guard(() => revertActivity(doc, entryId, 'local', actor)) !== undefined,
    };
  }, [doc, manager, actor, readOnly]);
}
