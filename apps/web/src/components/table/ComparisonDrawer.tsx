import { useMemo, useState } from 'react';
import { Crown, Download, Filter, TriangleAlert, X } from 'lucide-react';
import { ENUMERATION_LIMIT } from '@forkcast/shared';
import { compareOn, resolveConfiguration, type Configuration } from '@forkcast/engine';
import { useDocContext } from '@/docs/DocContext';
import { useAnalysis } from '@/docs/useAnalysis';
import { useUiStore } from '@/store/ui';
import { configurationsToCsv } from '@/lib/csv';
import { formatNumber, plural } from '@/lib/format';
import { downloadText, slugifyFilename } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Hint } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfigurationRows, type SortState } from './ConfigurationRows';

function parseFilter(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function ComparisonDrawer() {
  const { tree } = useDocContext();
  const analysis = useAnalysis(tree);
  const highlightedKey = useUiStore((s) => s.highlightedKey);
  const setHighlight = useUiStore((s) => s.setHighlight);
  const clearHighlight = useUiStore((s) => s.clearHighlight);
  const setTableOpen = useUiStore((s) => s.setTableOpen);

  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [paretoOnly, setParetoOnly] = useState(false);

  const paretoKeys = useMemo(() => new Set(analysis.paretoKeys), [analysis]);
  const { criteria } = tree;

  const rows = useMemo(() => {
    const source = analysis.enumerated ? analysis.configurations : analysis.pareto;
    let list = source;
    const active = criteria
      .map((c) => ({ c, max: parseFilter(filters[c.id]) }))
      .filter((f): f is { c: (typeof criteria)[number]; max: number } => f.max !== null);
    if (active.length > 0) {
      list = list.filter((row) =>
        active.every(({ c, max }) => {
          const v = row.totals[c.id];
          return v === undefined || v <= (c.aggregation === 'probOr' ? max / 100 : max);
        }),
      );
    }
    if (paretoOnly) list = list.filter((row) => paretoKeys.has(row.key));
    if (sort) {
      const criterion = criteria.find((c) => c.id === sort.criterionId);
      if (criterion) {
        const sign = sort.direction === 'asc' ? 1 : -1;
        list = [...list].sort((a, b) => sign * compareOn(criterion, a.totals, b.totals));
      }
    } else if (paretoKeys.size > 0) {
      list = [...list].sort((a, b) => Number(paretoKeys.has(b.key)) - Number(paretoKeys.has(a.key)));
    }
    return list;
  }, [analysis, criteria, filters, paretoOnly, paretoKeys, sort]);

  const activeFilterCount = tree.criteria.filter((c) => parseFilter(filters[c.id]) !== null).length;

  const onSort = (criterionId: string) =>
    setSort((prev) =>
      prev?.criterionId === criterionId
        ? prev.direction === 'asc'
          ? { criterionId, direction: 'desc' }
          : null
        : { criterionId, direction: 'asc' },
    );

  const onRowClick = (config: Configuration) => {
    if (highlightedKey === config.key) {
      clearHighlight();
      return;
    }
    const resolved = resolveConfiguration(tree, { choices: config.choices, included: config.included });
    setHighlight(resolved.nodeIds, config.key);
  };

  const exportCsv = () => {
    const csv = configurationsToCsv(tree, rows, paretoKeys);
    downloadText(`${slugifyFilename(tree.meta.title)}-configurations.csv`, csv, 'text/csv;charset=utf-8');
  };

  return (
    <section className="flex h-[42vh] min-h-[14rem] shrink-0 flex-col border-t bg-background" aria-label="Comparaison des configurations">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2 text-sm">
        <div className="font-medium">
          {plural(analysis.count, 'configuration')}
          <span className="font-normal text-muted-foreground">
            {' '}
            · {formatNumber(rows.length)} affichée{rows.length > 1 ? 's' : ''} · {plural(analysis.pareto.length, 'optimum de Pareto', 'optima de Pareto')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="pareto-only" checked={paretoOnly} onCheckedChange={setParetoOnly} />
          <Label htmlFor="pareto-only" className="flex items-center gap-1 font-normal">
            <Crown className="size-3.5 text-or" /> Pareto uniquement
          </Label>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter /> Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-2">
            <p className="text-xs text-muted-foreground">Valeur maximale par critère (vide = pas de filtre).</p>
            {tree.criteria.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-sm">
                <Label htmlFor={`filter-${c.id}`} className="truncate font-normal">
                  {c.label} ≤
                </Label>
                <Input
                  id={`filter-${c.id}`}
                  value={filters[c.id] ?? ''}
                  inputMode="decimal"
                  placeholder={c.aggregation === 'probOr' ? '%' : (c.unit ?? '')}
                  className="h-8 text-right"
                  onChange={(e) => setFilters((prev) => ({ ...prev, [c.id]: e.target.value }))}
                />
              </div>
            ))}
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilters({})}>
                Effacer les filtres
              </Button>
            )}
          </PopoverContent>
        </Popover>
        {highlightedKey && (
          <Button variant="ghost" size="sm" onClick={clearHighlight}>
            Retirer la surbrillance
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Hint label="Exporter le tableau en CSV">
            <Button variant="ghost" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download /> CSV
            </Button>
          </Hint>
          <Hint label="Fermer le tableau">
            <Button variant="ghost" size="icon-sm" onClick={() => setTableOpen(false)} aria-label="Fermer le tableau">
              <X />
            </Button>
          </Hint>
        </div>
      </header>

      {analysis.warnings.length > 0 && !analysis.enumerated && (
        <div className="flex items-start gap-2 border-b bg-or/10 px-3 py-2 text-xs">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-or" />
          <span>
            {formatNumber(analysis.count)} configurations dépassent la limite d’énumération ({formatNumber(ENUMERATION_LIMIT)}) : seuls le
            front de Pareto{analysis.paretoExact ? '' : ' (approché)'} et les meilleures configurations par critère sont calculés.
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {tree.criteria.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Ajoutez au moins un critère (panneau « Critères ») pour comparer les configurations.
          </p>
        ) : (
          <>
            <ConfigurationRows
              tree={tree}
              rows={rows}
              paretoKeys={paretoKeys}
              highlightedKey={highlightedKey}
              sort={sort}
              onSort={onSort}
              onRowClick={onRowClick}
            />
            {!analysis.enumerated &&
              tree.criteria.map((c) => {
                const best = analysis.best[c.id] ?? [];
                if (best.length === 0) return null;
                return (
                  <div key={c.id} className="mt-4">
                    <h3 className="sticky top-0 border-y bg-muted/60 px-3 py-1 text-xs font-medium">
                      Meilleures configurations — {c.label}
                    </h3>
                    <ConfigurationRows
                      tree={tree}
                      rows={best}
                      paretoKeys={paretoKeys}
                      highlightedKey={highlightedKey}
                      onRowClick={onRowClick}
                    />
                  </div>
                );
              })}
          </>
        )}
      </div>
    </section>
  );
}
