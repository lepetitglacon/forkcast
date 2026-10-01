import { useEffect } from 'react';
import type * as Y from 'yjs';
import { toast } from 'sonner';
import { useUiStore } from '@/store/ui';
import { useActivity } from './useActivity';

export const AI_HIGHLIGHT_MS = 8000;
const MAX_INDIVIDUAL_TOASTS = 3;

/**
 * Watches the shared history: new entries made by the assistant get a temporary
 * highlight on the canvas and a toast with an "Annuler" action; they are then marked seen.
 */
export function useAssistantActivity(doc: Y.Doc, treeKey: string, revert: (entryId: string) => boolean): void {
  const activity = useActivity(doc);
  const lastSeen = useUiStore((s) => s.lastSeenActivity[treeKey]);

  useEffect(() => {
    if (activity.length === 0) return;
    const store = useUiStore.getState();
    const latest = activity[activity.length - 1]!.id;
    if (lastSeen === undefined) {
      // First time this tree is opened on this device: nothing to report yet.
      store.setLastSeen(treeKey, latest);
      return;
    }
    if (lastSeen === latest) return;
    const index = activity.findIndex((e) => e.id === lastSeen);
    const fresh = index < 0 ? activity.slice(-20) : activity.slice(index + 1);
    const fromAi = fresh.filter((e) => e.actor === 'ai' && !e.reverted);
    store.setLastSeen(treeKey, latest);
    if (fromAi.length === 0) return;

    store.addAiHighlight(
      fromAi.flatMap((e) => e.nodeIds),
      Date.now() + AI_HIGHLIGHT_MS,
    );
    // Not cleared on re-run on purpose: the highlight must fade even if more updates arrive.
    setTimeout(() => useUiStore.getState().pruneAiHighlight(Date.now()), AI_HIGHLIGHT_MS + 50);

    if (fromAi.length <= MAX_INDIVIDUAL_TOASTS) {
      for (const entry of fromAi) {
        toast('Modifié par l’assistant', {
          description: entry.summary,
          duration: 10_000,
          action: {
            label: 'Annuler',
            onClick: () => {
              if (revert(entry.id)) toast.success('Modification de l’assistant annulée');
            },
          },
        });
      }
    } else {
      toast('Modifié par l’assistant', {
        description: `${fromAi.length} modifications depuis votre dernière visite.`,
        duration: 10_000,
        action: {
          label: 'Voir l’historique',
          onClick: () => {
            const s = useUiStore.getState();
            s.select(null);
            s.setHistoryFilter('ai');
            s.setHistoryOpen(true);
          },
        },
      });
    }
  }, [activity, lastSeen, treeKey, revert]);
}
