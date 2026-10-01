import { useCallback } from 'react';
import type { ActivityEntry } from '@forkcast/shared';
import { toast } from 'sonner';
import { useDocContext } from '@/docs/DocContext';
import { useNodeActions } from '@/docs/useNodeActions';
import { useUiStore } from '@/store/ui';
import { useFitTo } from '@/components/canvas/useFitTo';

/** Click on a history entry (highlight + show what it touched) and "Annuler". */
export function useHistoryActions() {
  const { tree, revert } = useDocContext();
  const actions = useNodeActions();
  const fitTo = useFitTo();

  const select = useCallback(
    (entry: ActivityEntry) => {
      const store = useUiStore.getState();
      const key = `history:${entry.id}`;
      if (store.highlightedKey === key) {
        store.clearHighlight();
        return;
      }
      const ids = entry.nodeIds.filter((id) => tree.nodes[id]);
      if (ids.length === 0) {
        if (entry.nodeIds.length > 0) toast.info('Les nœuds concernés n’existent plus.');
        store.clearHighlight();
        return;
      }
      // Highlight only: changing the selection would narrow the history to that node.
      actions.reveal(ids);
      store.setHighlight(ids, key);
      // Next tick: expanded ancestors and the highlight must be rendered first.
      setTimeout(() => {
        fitTo(ids, { padding: 0.4, maxZoom: 1, duration: 300 });
      }, 30);
    },
    [tree, actions, fitTo],
  );

  const undoEntry = useCallback(
    (entry: ActivityEntry) => {
      if (revert(entry.id)) toast.success('Modification annulée', { description: entry.summary });
    },
    [revert],
  );

  return { select, revert: undoEntry };
}
