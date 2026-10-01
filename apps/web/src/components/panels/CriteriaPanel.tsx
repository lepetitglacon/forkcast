import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { Aggregation, Criterion, Direction } from '@forkcast/shared';
import { AGGREGATIONS, DIRECTIONS } from '@forkcast/shared';
import type { CriterionPatch } from '@forkcast/shared';
import { toast } from 'sonner';
import { useDocContext } from '@/docs/DocContext';
import { AGGREGATION_HELP, AGGREGATION_LABELS, DIRECTION_LABELS, plural } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { DraftInput } from '@/components/ui/draft-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Hint } from '@/components/ui/tooltip';

function AggregationSelect({
  value,
  onChange,
  disabled,
  size,
}: {
  value: Aggregation;
  onChange: (v: Aggregation) => void;
  disabled?: boolean;
  size?: 'sm' | 'default';
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={(v) => onChange(v as Aggregation)}>
      <SelectTrigger size={size} aria-label="Agrégation">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AGGREGATIONS.map((a) => (
          <SelectItem key={a} value={a}>
            {AGGREGATION_LABELS[a]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DirectionSelect({
  value,
  onChange,
  disabled,
  size,
}: {
  value: Direction;
  onChange: (v: Direction) => void;
  disabled?: boolean;
  size?: 'sm' | 'default';
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={(v) => onChange(v as Direction)}>
      <SelectTrigger size={size} aria-label="Direction">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DIRECTIONS.map((d) => (
          <SelectItem key={d} value={d}>
            {DIRECTION_LABELS[d]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CriterionRow({
  criterion,
  index,
  total,
  valueCount,
  onMove,
  onRemove,
}: {
  criterion: Criterion;
  index: number;
  total: number;
  valueCount: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { readOnly, exec } = useDocContext();
  const patch = (p: CriterionPatch) => exec({ type: 'updateCriterion', criterionId: criterion.id, patch: p });
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-1">
        <DraftInput
          value={criterion.label}
          disabled={readOnly}
          aria-label="Libellé du critère"
          className="h-8 flex-1 font-medium"
          onCommit={(label) => {
            if (label.trim()) patch({ label: label.trim() });
          }}
        />
        <Hint label="Monter">
          <Button variant="ghost" size="icon-xs" disabled={readOnly || index === 0} onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
        </Hint>
        <Hint label="Descendre">
          <Button variant="ghost" size="icon-xs" disabled={readOnly || index === total - 1} onClick={() => onMove(1)}>
            <ArrowDown />
          </Button>
        </Hint>
        <Hint label="Supprimer le critère">
          <Button variant="ghost" size="icon-xs" className="text-destructive" disabled={readOnly} onClick={onRemove}>
            <Trash2 />
          </Button>
        </Hint>
      </div>
      <div className="grid grid-cols-[5rem_1fr_1fr] gap-2">
        <DraftInput
          value={criterion.unit ?? ''}
          disabled={readOnly}
          placeholder="Unité"
          aria-label="Unité"
          className="h-8 text-xs"
          onCommit={(unit) => patch({ unit: unit.trim() || null })}
        />
        <AggregationSelect size="sm" value={criterion.aggregation} disabled={readOnly} onChange={(aggregation) => patch({ aggregation })} />
        <DirectionSelect size="sm" value={criterion.direction} disabled={readOnly} onChange={(direction) => patch({ direction })} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {AGGREGATION_HELP[criterion.aggregation]}
        {valueCount > 0 && ` ${plural(valueCount, 'nœud renseigné', 'nœuds renseignés')}.`}
      </p>
    </div>
  );
}

export function CriteriaPanel() {
  const { tree, readOnly, exec, execMany } = useDocContext();
  const [label, setLabel] = useState('');
  const [unit, setUnit] = useState('');
  const [aggregation, setAggregation] = useState<Aggregation>('sum');
  const [direction, setDirection] = useState<Direction>('minimize');
  const [toRemove, setToRemove] = useState<Criterion | null>(null);

  const valueCounts: Record<string, number> = {};
  for (const node of Object.values(tree.nodes)) {
    for (const cid of Object.keys(node.values)) valueCounts[cid] = (valueCounts[cid] ?? 0) + 1;
  }

  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const r = exec({
      type: 'addCriterion',
      criterion: { label: trimmed, aggregation, direction, ...(unit.trim() ? { unit: unit.trim() } : {}) },
    });
    if (r) {
      setLabel('');
      setUnit('');
      toast.success(`Critère « ${trimmed} » ajouté`);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= tree.criteria.length) return;
    const order = tree.criteria.map((c) => c.id);
    const a = order[index]!;
    order[index] = order[target]!;
    order[target] = a;
    const moved = tree.criteria[index]!;
    execMany(
      order.map((id, i) => ({ type: 'updateCriterion' as const, criterionId: id, patch: { order: i } })),
      `Critère « ${moved.label} » ${direction < 0 ? 'remonté' : 'descendu'}`,
    );
  };

  return (
    <div className="space-y-4">
      {tree.criteria.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun critère pour l’instant. Les critères (coût, délai, risque…) permettent de comparer les configurations de l’arbre.
        </p>
      ) : (
        <div className="space-y-2">
          {tree.criteria.map((c, i) => (
            <CriterionRow
              key={c.id}
              criterion={c}
              index={i}
              total={tree.criteria.length}
              valueCount={valueCounts[c.id] ?? 0}
              onMove={(d) => move(i, d)}
              onRemove={() => setToRemove(c)}
            />
          ))}
        </div>
      )}

      {!readOnly && (
        <form
          className="space-y-2 rounded-lg border border-dashed p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Label className="text-xs text-muted-foreground">Nouveau critère</Label>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (ex. Coût mensuel)" className="h-8" aria-label="Libellé" />
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unité" className="h-8" aria-label="Unité" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <AggregationSelect size="sm" value={aggregation} onChange={setAggregation} />
            <DirectionSelect size="sm" value={direction} onChange={setDirection} />
          </div>
          <Button type="submit" size="sm" disabled={!label.trim()} className="w-full">
            <Plus /> Ajouter le critère
          </Button>
        </form>
      )}

      <AlertDialog open={toRemove !== null} onOpenChange={(open) => !open && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le critère « {toRemove?.label} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove && (valueCounts[toRemove.id] ?? 0) > 0
                ? `Les valeurs saisies sur ${plural(valueCounts[toRemove.id] ?? 0, 'nœud', 'nœuds')} seront perdues (annulable avec Ctrl+Z).`
                : 'Aucune valeur n’est associée à ce critère.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => {
                if (!toRemove) return;
                const r = exec({ type: 'removeCriterion', criterionId: toRemove.id });
                if (r) toast.success(`Critère « ${toRemove.label} » supprimé`);
                setToRemove(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
