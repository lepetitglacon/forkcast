import { memo, useEffect, useMemo, useRef, useState } from 'react';
import rough from 'roughjs';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CornerDownRight,
  PencilLine,
  Plus,
  Trash2,
} from 'lucide-react';
import type { NodeKind } from '@forkcast/shared';
import { cn, hashString } from '@/lib/utils';
import { KIND_DESCRIPTIONS, KIND_LABELS, plural } from '@/lib/format';
import { childSide, parentSide, type Side } from '@/lib/orientation';
import { useNodeActions } from '@/docs/useNodeActions';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { connectEndedRecently } from './connectState';
import { SketchFrame } from './SketchFrame';
import { ValueChip } from './ValueChip';
import type { FlowNode, TreeNodeData } from './nodeData';
import { useUiStore } from '@/store/ui';

const POSITION: Record<Side, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

function KindBadge({ kind, sketch }: { kind: NodeKind; sketch: boolean }) {
  if (kind === 'leaf') return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={kind} className={cn('shrink-0', sketch && 'rounded-sm')}>
          {KIND_LABELS[kind]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{KIND_DESCRIPTIONS[kind]}</TooltipContent>
    </Tooltip>
  );
}

function RenameInput({ id, label }: { id: string; label: string }) {
  const actions = useNodeActions();
  const [value, setValue] = useState(label);
  const ref = useRef<HTMLInputElement>(null);

  // A brand new card may not be focusable yet when the input mounts: retry for a while.
  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryFocus = () => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.select();
      if (document.activeElement !== el && attempts++ < 50) timer = setTimeout(tryFocus, 40);
    };
    tryFocus();
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => actions.commitRename(id, value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          actions.commitRename(id, value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          actions.cancelRename();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          actions.commitRename(id, value);
          actions.addChild(id);
        }
      }}
      className="nodrag nopan w-full min-w-0 rounded-sm border border-ring bg-background px-1 text-sm font-medium outline-none"
      aria-label="Nom du nœud"
    />
  );
}

function NodeMenu({ data }: { data: TreeNodeData }) {
  const actions = useNodeActions();
  const id = data.nodeId;
  const canEdit = !data.readOnly;
  const optionalAvailable = canEdit && !data.isRoot && data.parentKind === 'and';
  return (
    <ContextMenuContent className="w-60">
      <ContextMenuItem disabled={!canEdit} onSelect={() => actions.startRename(id)}>
        <PencilLine /> Renommer
        <ContextMenuShortcut>F2</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!canEdit} onSelect={() => actions.addChild(id)}>
        <CornerDownRight /> Ajouter un enfant
        <ContextMenuShortcut>Tab</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!canEdit || data.isRoot} onSelect={() => actions.addSibling(id)}>
        <Plus /> Ajouter un frère
        <ContextMenuShortcut>Entrée</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={!canEdit}>
          <ChevronRight /> Type de nœud
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuRadioGroup value={data.kind} onValueChange={(v) => actions.setKind(id, v as NodeKind)}>
            <ContextMenuRadioItem value="and">ET — {KIND_DESCRIPTIONS.and.toLowerCase()}</ContextMenuRadioItem>
            <ContextMenuRadioItem value="or">OU — {KIND_DESCRIPTIONS.or.toLowerCase()}</ContextMenuRadioItem>
            <ContextMenuRadioItem value="leaf" disabled={data.hasChildren}>
              Feuille — {KIND_DESCRIPTIONS.leaf.toLowerCase()}
            </ContextMenuRadioItem>
          </ContextMenuRadioGroup>
        </ContextMenuSubContent>
      </ContextMenuSub>
      {optionalAvailable && (
        <ContextMenuCheckboxItem checked={data.optional} onCheckedChange={(checked) => actions.setOptional(id, checked === true)}>
          Optionnel
        </ContextMenuCheckboxItem>
      )}
      {data.hasChildren && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => actions.toggleCollapse(id)}>
            {data.collapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
            {data.collapsed ? 'Déplier' : 'Replier'}
            <ContextMenuShortcut>Espace</ContextMenuShortcut>
          </ContextMenuItem>
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem destructive disabled={!canEdit || data.isRoot} onSelect={() => actions.requestDelete(id)}>
        <Trash2 /> Supprimer
        <ContextMenuShortcut>Suppr</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

function SketchCircle({ seed }: { seed: number }) {
  const d = useMemo(() => {
    const generator = rough.generator({ options: { seed, roughness: 1.2, strokeWidth: 1.4 } });
    return generator
      .toPaths(generator.circle(11, 11, 18))
      .map((p) => p.d)
      .join(' ');
  }, [seed]);
  return (
    <svg aria-hidden className="pointer-events-none absolute -inset-px size-[22px] overflow-visible" viewBox="0 0 22 22">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

/**
 * "+" handle: click = add a child; drag = connection line, dropped on empty canvas →
 * new child there, dropped on a card → that card is re-attached under this one.
 */
function AddHandle({ id, side, offset, sketch }: { id: string; side: Side; offset: boolean; sketch: boolean }) {
  const actions = useNodeActions();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Handle
          id="add"
          type="source"
          position={POSITION[side]}
          isConnectableEnd={false}
          className={cn('fc-add', offset && 'fc-add-offset')}
          onClick={(e) => {
            e.stopPropagation();
            if (connectEndedRecently()) return;
            actions.select(id);
            actions.addChild(id);
            useUiStore.getState().setNodeDrawerOpen(true);
          }}
          aria-label="Ajouter un enfant"
        >
          {sketch && <SketchCircle seed={hashString(`${id}+`)} />}
          <Plus className="pointer-events-none size-3" strokeWidth={2.75} />
        </Handle>
      </TooltipTrigger>
      <TooltipContent side={side}>Cliquer : ajouter un enfant · Glisser : placer ou rattacher</TooltipContent>
    </Tooltip>
  );
}

function TreeNodeViewInner({ id, data, selected }: NodeProps<FlowNode>) {
  const actions = useNodeActions();
  const presenceColor = data.presence[0]?.color;
  const outSide = childSide(data.orientation);
  const inSide = parentSide(data.orientation);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'relative w-[240px] rounded-xl bg-card px-3 py-2 text-card-foreground shadow-sm transition-[box-shadow,opacity] duration-150',
            data.sketch ? 'border-transparent' : 'border',
            data.isRoot && !data.sketch && 'border-2 border-primary',
            data.isRoot && 'bg-primary/5',
            selected && 'ring-2 ring-ring ring-offset-2 ring-offset-canvas',
            data.highlighted && !selected && 'ring-2 ring-primary/70',
            data.dimmed && 'opacity-40',
            data.aiHighlighted && 'fc-ai-highlight',
            data.dropTarget && 'outline-2 outline-offset-2 outline-primary outline-dashed',
            data.sketch && 'font-sketch',
          )}
          style={presenceColor && !selected ? { boxShadow: `0 0 0 2px ${presenceColor}` } : undefined}
          data-node-id={id}
        >
          {data.sketch && (
            <SketchFrame
              seed={hashString(id)}
              className={cn(data.isRoot ? 'text-primary' : 'text-foreground/70')}
              strokeWidth={data.isRoot ? 2.2 : 1.5}
            />
          )}
          <Handle id="in" type="target" position={POSITION[inSide]} className="fc-handle" isConnectable={false} />
          <Handle id="out" type="source" position={POSITION[outSide]} className="fc-handle" isConnectable={false} />
          {!data.readOnly && <AddHandle id={id} side={outSide} offset={data.hasChildren && !data.collapsed} sketch={data.sketch} />}

          {data.presence.length > 0 && (
            <div className="absolute -top-3 right-2 flex gap-1">
              {data.presence.map((p) => (
                <span
                  key={p.id}
                  className="rounded px-1 text-[10px] leading-4 font-medium text-white shadow-sm"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <KindBadge kind={data.kind} sketch={data.sketch} />
            {data.renaming ? (
              <RenameInput key={id} id={id} label={data.label} />
            ) : (
              <span
                className={cn('line-clamp-2 min-w-0 flex-1 text-sm leading-tight font-medium break-words', data.isRoot && 'text-[15px]')}
                title={data.notes || data.label}
              >
                {data.label || <span className="text-muted-foreground italic">(sans titre)</span>}
              </span>
            )}
            {data.hasChildren && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="nodrag nopan ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-medium text-muted-foreground hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.toggleCollapse(id);
                    }}
                    aria-label={data.collapsed ? 'Déplier' : 'Replier'}
                  >
                    {data.collapsed ? `+${data.hiddenCount}` : <ChevronsDownUp className="size-3" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {data.collapsed ? `${plural(data.hiddenCount, 'nœud masqué', 'nœuds masqués')} — déplier` : 'Replier la branche'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {data.optional && (
            <div className="mt-1">
              <Badge variant="muted">optionnel</Badge>
            </div>
          )}

          {data.values.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {data.values.map((v) => (
                <ValueChip key={v.criterionId} label={v.label} text={v.text} ai={v.ai} />
              ))}
            </div>
          )}

          {data.aggregates.length > 0 && (
            <div className="mt-1.5 space-y-0.5 border-t border-dashed pt-1.5 text-[11px] leading-4">
              {data.aggregates.map((a) => (
                <div key={a.criterionId} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-muted-foreground">{a.label}</span>
                  <span className={cn('shrink-0 tabular-nums', a.exact ? 'font-medium' : 'text-foreground/80')}>
                    {a.exact ? '= ' : ''}
                    {a.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <NodeMenu data={data} />
    </ContextMenu>
  );
}

export const TreeNodeView = memo(TreeNodeViewInner);
