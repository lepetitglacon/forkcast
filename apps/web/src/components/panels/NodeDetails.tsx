import type { ReactNode } from 'react';
import { CornerDownRight, History, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { NodeKind } from '@forkcast/shared';
import { useDocContext } from '@/docs/DocContext';
import { useAggregates } from '@/docs/useAggregates';
import { useNodeActions } from '@/docs/useNodeActions';
import { getNodeAvailability } from '@/lib/nodeAvailability';
import { KIND_DESCRIPTIONS, KIND_LABELS, formatNumber, formatRange, formatValue } from '@/lib/format';
import { EMPTY_IDS, useUiStore } from '@/store/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DraftInput, DraftTextarea } from '@/components/ui/draft-input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { ValueInput } from './ValueInput';

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function NodeDetails({ nodeId }: { nodeId: string }) {
  const { tree, treeKey, readOnly, exec } = useDocContext();
  const actions = useNodeActions();
  const aggregates = useAggregates(tree);
  const collapsedIds = useUiStore((s) => s.collapsed[treeKey]) ?? EMPTY_IDS;
  const setCriteriaOpen = useUiStore((s) => s.setCriteriaOpen);
  const node = tree.nodes[nodeId];
  const a = getNodeAvailability(tree, nodeId, { readOnly, collapsed: collapsedIds.includes(nodeId) });
  if (!node || !a) return null;
  const agg = aggregates[nodeId];

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="node-label" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {a.isRoot ? 'Racine' : 'Nœud'}
        </Label>
        <DraftInput
          id="node-label"
          value={node.label}
          disabled={readOnly}
          onCommit={(label) => actions.commitRename(nodeId, label)}
          placeholder="Nom du nœud"
          className="font-medium"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          ariaLabel="Type de nœud"
          value={node.kind}
          disabled={readOnly}
          onChange={(kind: NodeKind) => actions.setKind(nodeId, kind)}
          options={(['and', 'or', 'leaf'] as const).map((kind) => ({
            value: kind,
            label: KIND_LABELS[kind],
            title: kind === 'leaf' && a.leafDisabled ? 'Feuille — impossible tant que le nœud a des enfants' : `${KIND_LABELS[kind]} — ${KIND_DESCRIPTIONS[kind].toLowerCase()}`,
            disabled: kind === 'leaf' && a.leafDisabled,
          }))}
        />
        {a.optionalAvailable ? (
          <div className="flex items-center gap-2">
            <Switch id="node-optional" checked={a.optional} onCheckedChange={(checked) => actions.setOptional(nodeId, checked)} />
            <Label htmlFor="node-optional" className="text-sm font-normal">
              Optionnel
            </Label>
          </div>
        ) : (
          node.optional && !a.isRoot && <Badge variant="muted">optionnel</Badge>
        )}
      </div>
      {!a.isRoot && !a.optionalAvailable && !readOnly && (
        <p className="text-[11px] text-muted-foreground">« Optionnel » est disponible pour les enfants d’un nœud ET.</p>
      )}

      <Section
        title="Valeurs"
        action={
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setCriteriaOpen(true)}>
            <SlidersHorizontal className="size-3" /> Gérer les critères
          </Button>
        }
      >
        {tree.criteria.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun critère : ajoutez-en (coût, délai, risque…) pour saisir des valeurs.</p>
        ) : (
          <div className="space-y-1.5">
            {tree.criteria.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_8.5rem] items-center gap-2">
                <span className="truncate text-sm" title={c.label}>
                  {c.label}
                </span>
                <ValueInput
                  criterion={c}
                  value={node.values[c.id]}
                  disabled={readOnly}
                  onCommit={(v) => exec({ type: 'setValues', nodeId, values: { [c.id]: v } })}
                />
              </div>
            ))}
          </div>
        )}
        {agg && a.hasChildren && tree.criteria.length > 0 && (
          <div className="space-y-1 rounded-lg border bg-muted/40 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Sous-arbre</span>
              <span className="text-muted-foreground">
                {formatNumber(agg.count)} configuration{agg.count > 1 ? 's' : ''}
              </span>
            </div>
            <dl className="space-y-0.5 text-xs">
              {tree.criteria.map((c) => {
                const min = agg.min[c.id];
                const max = agg.max[c.id];
                return (
                  <div key={c.id} className="flex justify-between gap-2">
                    <dt className="truncate text-muted-foreground">{c.label}</dt>
                    <dd className="shrink-0 tabular-nums">{agg.hasChoices ? formatRange(c, min, max) : formatValue(c, max ?? min)}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
      </Section>

      <Section title="Notes">
        <Label htmlFor="node-notes" className="sr-only">
          Notes
        </Label>
        <DraftTextarea
          id="node-notes"
          value={node.notes ?? ''}
          disabled={readOnly}
          placeholder={readOnly ? 'Aucune note' : 'Contexte, liens, hypothèses… (Ctrl + Entrée pour valider)'}
          onCommit={(notes) => exec({ type: 'setNotes', nodeId, notes: notes.trim() || null })}
        />
      </Section>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => actions.addChild(nodeId)}>
            <CornerDownRight /> Enfant
          </Button>
          {a.addSibling && (
            <Button variant="outline" size="sm" onClick={() => actions.addSibling(nodeId)}>
              <Plus /> Frère
            </Button>
          )}
          {a.remove && (
            <Button variant="outline" size="sm" className="ml-auto text-destructive" onClick={() => actions.requestDelete(nodeId)}>
              <Trash2 /> Supprimer
            </Button>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => useUiStore.getState().setHistoryOpen(true)}
      >
        <History /> Voir l’historique de ce nœud
      </Button>
    </div>
  );
}
