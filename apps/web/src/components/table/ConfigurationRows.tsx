import { ArrowDown, ArrowUp, ArrowUpDown, Crown } from 'lucide-react';
import type { Tree } from '@forkcast/shared';
import type { Configuration } from '@forkcast/engine';
import { cn } from '@/lib/utils';
import { formatValue } from '@/lib/format';
import { describeConfiguration } from '@/lib/describe';
import { Badge } from '@/components/ui/badge';

export interface SortState {
  criterionId: string;
  direction: 'asc' | 'desc';
}

interface ConfigurationRowsProps {
  tree: Tree;
  rows: readonly Configuration[];
  paretoKeys: ReadonlySet<string>;
  highlightedKey: string | null;
  sort?: SortState | null;
  onSort?: (criterionId: string) => void;
  onRowClick: (config: Configuration) => void;
  emptyLabel?: string;
}

export function ConfigurationRows({
  tree,
  rows,
  paretoKeys,
  highlightedKey,
  sort,
  onSort,
  onRowClick,
  emptyLabel = 'Aucune configuration ne correspond aux filtres.',
}: ConfigurationRowsProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-background">
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="w-10 px-2 py-1.5 font-medium">#</th>
          {tree.criteria.map((c) => {
            const active = sort?.criterionId === c.id;
            return (
              <th key={c.id} className="px-2 py-1.5 font-medium whitespace-nowrap">
                {onSort ? (
                  <button
                    type="button"
                    className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}
                    onClick={() => onSort(c.id)}
                  >
                    {c.label}
                    {c.unit && <span className="opacity-70">({c.unit})</span>}
                    {active ? (
                      sort?.direction === 'asc' ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40" />
                    )}
                  </button>
                ) : (
                  <span>
                    {c.label}
                    {c.unit && <span className="opacity-70"> ({c.unit})</span>}
                  </span>
                )}
              </th>
            );
          })}
          <th className="px-2 py-1.5 font-medium">Choix</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={tree.criteria.length + 2} className="px-2 py-6 text-center text-muted-foreground">
              {emptyLabel}
            </td>
          </tr>
        )}
        {rows.map((row, i) => {
          const pareto = paretoKeys.has(row.key);
          const active = highlightedKey === row.key;
          const choices = describeConfiguration(tree, row);
          return (
            <tr
              key={row.key}
              onClick={() => onRowClick(row)}
              className={cn(
                'cursor-pointer border-b transition-colors hover:bg-accent/60',
                pareto && 'bg-or/10 dark:bg-or/10',
                active && 'bg-primary/15 hover:bg-primary/20',
              )}
              aria-selected={active}
            >
              <td className="px-2 py-1.5 align-top text-xs text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1">
                  {i + 1}
                  {pareto && <Crown className="size-3 text-or" aria-label="Pareto" />}
                </span>
              </td>
              {tree.criteria.map((c) => (
                <td key={c.id} className="px-2 py-1.5 align-top whitespace-nowrap tabular-nums">
                  {formatValue(c, row.totals[c.id])}
                </td>
              ))}
              <td className="px-2 py-1.5 align-top">
                {choices.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Aucune alternative</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {choices.map((d) => (
                      <Badge key={`${d.nodeId}-${d.kind}`} variant={d.kind === 'or' ? 'secondary' : d.included ? 'outline' : 'muted'} className="font-normal">
                        {d.kind === 'or' ? (
                          <>
                            <span className="text-muted-foreground">{d.label} →</span> {d.detail}
                          </>
                        ) : (
                          <>
                            {d.label} : {d.detail}
                          </>
                        )}
                      </Badge>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
