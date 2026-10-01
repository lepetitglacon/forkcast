import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Criterion, NodeValue } from '@forkcast/shared';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ValueInputProps {
  criterion: Criterion;
  value: NodeValue | undefined;
  disabled?: boolean;
  onCommit: (value: number | null) => void;
}

function toDisplay(criterion: Criterion, value: number | undefined): string {
  if (value === undefined) return '';
  if (criterion.aggregation === 'probOr') return String(Number.parseFloat((value * 100).toPrecision(10)));
  return String(value);
}

function parseInput(criterion: Criterion, raw: string): number | null | undefined {
  const text = raw.trim().replace(',', '.');
  if (text === '') return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return undefined;
  return criterion.aggregation === 'probOr' ? n / 100 : n;
}

/** Number input for one criterion value (empty = unset; probabilities edited in %). */
export function ValueInput({ criterion, value, disabled, onCommit }: ValueInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const ai = value?.estimatedBy === 'ai';
  const display = toDisplay(criterion, value?.value);
  const suffix = criterion.aggregation === 'probOr' ? '%' : criterion.unit;

  const commit = () => {
    if (draft === null) return;
    const parsed = parseInput(criterion, draft);
    setDraft(null);
    if (parsed === undefined) return; // invalid: keep the previous value
    if (parsed === null && value === undefined) return;
    if (parsed !== null && value !== undefined && parsed === value.value && !ai) return;
    onCommit(parsed);
  };

  return (
    <div className="relative flex items-center">
      {ai && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Sparkles className="absolute left-2 size-3.5 text-ai" aria-hidden />
          </TooltipTrigger>
          <TooltipContent>Estimation de l’assistant — modifiez la valeur pour la confirmer</TooltipContent>
        </Tooltip>
      )}
      <Input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={draft ?? display}
        placeholder="—"
        aria-label={criterion.label}
        onFocus={() => setDraft(display)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        className={cn('h-8 text-right tabular-nums', ai && 'border-dashed border-ai/80 bg-ai/5 pl-7', suffix && 'pr-9')}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2 text-xs text-muted-foreground">{suffix}</span>
      )}
    </div>
  );
}
