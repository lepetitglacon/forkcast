import { useMemo, useState } from 'react';
import { useDocContext } from '@/docs/DocContext';
import { useActivity } from '@/docs/useActivity';
import { groupByDay, historyCounts, HISTORY_FILTER_LABELS, scopeHistory, type HistoryFilter } from '@/lib/history';
import { useNow } from '@/lib/useNow';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui';
import { Button } from '@/components/ui/button';
import { HistoryEntryItem } from './HistoryEntryItem';
import { useHistoryActions } from './useHistoryActions';

const PAGE = 100;
const FILTERS: HistoryFilter[] = ['all', 'people', 'ai'];

/**
 * History of everyone, newest first, grouped by day. Scope follows the selection: the whole
 * tree when nothing is selected, only the entries touching the selected node otherwise.
 */
export function HistoryPanel() {
  const { doc, tree, readOnly } = useDocContext();
  const entries = useActivity(doc);
  const now = useNow();
  const filter = useUiStore((s) => s.historyFilter);
  const setFilter = useUiStore((s) => s.setHistoryFilter);
  const highlightedKey = useUiStore((s) => s.highlightedKey);
  const selectedId = useUiStore((s) => s.selectedId);
  const scopeNode = selectedId ? tree.nodes[selectedId] : undefined;
  const scopeId = scopeNode ? scopeNode.id : null;
  const [limit, setLimit] = useState(PAGE);
  const { select, revert } = useHistoryActions();

  const filtered = useMemo(() => scopeHistory(entries, scopeId, filter), [entries, scopeId, filter]);
  const counts = useMemo(() => historyCounts(entries, scopeId), [entries, scopeId]);
  const groups = useMemo(() => groupByDay(filtered.slice(0, limit), now), [filtered, limit, now]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs">
        {scopeNode ? (
          <>
            <span className="min-w-0 flex-1 truncate">
              Modifications de <span className="font-semibold">« {scopeNode.label || 'sans titre'} »</span>
            </span>
            <Button variant="link" size="sm" className="h-auto shrink-0 p-0 text-xs" onClick={() => useUiStore.getState().select(null)}>
              Voir tout l’arbre
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">Toutes les modifications de l’arbre</span>
        )}
      </div>
      <div className="flex gap-1.5 border-b px-3 py-2" role="radiogroup" aria-label="Filtrer l’historique">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => {
              setFilter(f);
              setLimit(PAGE);
            }}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors',
              filter === f ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
              f === 'ai' && filter !== f && 'border-ai/40 text-ai',
            )}
          >
            {HISTORY_FILTER_LABELS[f]}
            <span className="opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {scopeNode
              ? filter === 'ai'
                ? 'Aucune modification de l’assistant sur ce nœud pour l’instant.'
                : 'Aucune modification sur ce nœud pour l’instant.'
              : filter === 'ai'
                ? 'Aucune modification de l’assistant pour l’instant. Connectez un assistant via MCP (Mon compte › Tokens MCP).'
                : 'Aucune modification enregistrée pour l’instant.'}
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="mb-1">
              <h3 className="sticky top-0 z-10 bg-card px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {g.label}
              </h3>
              <ul className="space-y-0.5">
                {g.entries.map((entry) => (
                  <HistoryEntryItem
                    key={entry.id}
                    entry={entry}
                    now={now}
                    readOnly={readOnly}
                    active={highlightedKey === `history:${entry.id}`}
                    onSelect={select}
                    onRevert={revert}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
        {filtered.length > limit && (
          <div className="p-2">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
              Afficher plus ({filtered.length - limit} restantes)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
