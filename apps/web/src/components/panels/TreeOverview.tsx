import { SlidersHorizontal } from 'lucide-react';
import { countConfigurations } from '@forkcast/engine';
import { useDocContext } from '@/docs/DocContext';
import { AGGREGATION_LABELS, DIRECTION_LABELS, formatNumber, plural } from '@/lib/format';
import { useUiStore } from '@/store/ui';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';

/** Shown in the details card when no node is selected. */
export function TreeOverview() {
  const { tree } = useDocContext();
  const setCriteriaOpen = useUiStore((s) => s.setCriteriaOpen);
  const nodeCount = Object.keys(tree.nodes).length;
  const configurations = tree.meta.rootId ? countConfigurations(tree) : 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-base leading-tight font-semibold break-words">{tree.meta.title || 'Sans titre'}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/40 p-2">
            <div className="text-lg font-semibold tabular-nums">{formatNumber(nodeCount)}</div>
            <div className="text-xs text-muted-foreground">nœud{nodeCount > 1 ? 's' : ''}</div>
          </div>
          <div className="rounded-lg border bg-muted/40 p-2">
            <div className="text-lg font-semibold tabular-nums">{formatNumber(configurations)}</div>
            <div className="text-xs text-muted-foreground">configuration{configurations > 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Critères</h3>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setCriteriaOpen(true)}>
            <SlidersHorizontal className="size-3" /> Gérer les critères
          </Button>
        </div>
        {tree.criteria.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun critère défini.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {tree.criteria.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-2">
                <span className="truncate">
                  {c.label}
                  {c.unit && <span className="text-muted-foreground"> ({c.unit})</span>}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {AGGREGATION_LABELS[c.aggregation]} · {DIRECTION_LABELS[c.direction].toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">{plural(tree.criteria.length, 'critère')}</p>
      </section>

      <section className="space-y-1.5 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <p>Sélectionnez une carte pour la modifier.</p>
        <p className="flex flex-wrap items-center gap-1">
          <Kbd>Tab</Kbd> enfant · <Kbd>Entrée</Kbd> frère · <Kbd>F2</Kbd> renommer · <Kbd>?</Kbd> tous les raccourcis
        </p>
      </section>
    </div>
  );
}
