import { forwardRef, type ReactNode } from 'react';
import {
  ChevronsDownUp,
  ChevronsUpDown,
  CircleDashed,
  CornerDownRight,
  PencilLine,
  Plus,
  Redo2,
  SlidersHorizontal,
  Table2,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { NodeKind } from '@forkcast/shared';
import { useDocContext } from '@/docs/DocContext';
import { useNodeActions } from '@/docs/useNodeActions';
import { getNodeAvailability } from '@/lib/nodeAvailability';
import { KIND_DESCRIPTIONS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EMPTY_IDS, useUiStore } from '@/store/ui';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ExportMenu } from './ExportMenu';
import { DRAWER_ROOM } from './drawer';

/** Toolbar button that does not keep the keyboard focus (shortcuts keep working after a click). */
export const ToolButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string; shortcut?: string; children: ReactNode }>(
  ({ label, shortcut, children, className, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          className={cn('rounded-lg', className)}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {label}
        {shortcut && <Kbd className="border-background/30 bg-background/15 text-background">{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  ),
);
ToolButton.displayName = 'ToolButton';

function Divider() {
  return <Separator orientation="vertical" className="mx-0.5 h-6" />;
}

function kindOptions(leafDisabled: boolean): SegmentedOption<NodeKind>[] {
  return [
    { value: 'and', label: 'ET', title: `ET — ${KIND_DESCRIPTIONS.and.toLowerCase()}` },
    { value: 'or', label: 'OU', title: `OU — ${KIND_DESCRIPTIONS.or.toLowerCase()}` },
    {
      value: 'leaf',
      label: 'Feuille',
      title: leafDisabled ? 'Feuille — impossible tant que le nœud a des enfants' : `Feuille — ${KIND_DESCRIPTIONS.leaf.toLowerCase()}`,
      disabled: leafDisabled,
    },
  ];
}

function NodeSection() {
  const { tree, treeKey, readOnly } = useDocContext();
  const actions = useNodeActions();
  const selectedId = useUiStore((s) => s.selectedId);
  const collapsedIds = useUiStore((s) => s.collapsed[treeKey]) ?? EMPTY_IDS;
  const a = getNodeAvailability(tree, selectedId, { readOnly, collapsed: selectedId ? collapsedIds.includes(selectedId) : false });
  if (!a) return null;
  const id = a.nodeId;
  const hasEditActions = a.addChild || a.changeKind || a.rename;
  if (!hasEditActions && !a.collapseAvailable) return null;
  return (
    <>
      <Divider />
      {a.addChild && (
        <ToolButton label="Ajouter un enfant" shortcut="Tab" onClick={() => {
            actions.addChild(id);
            useUiStore.getState().setNodeDrawerOpen(true);
          }}>
          <CornerDownRight />
        </ToolButton>
      )}
      {a.addSibling && (
        <ToolButton label="Ajouter un frère" shortcut="Entrée" onClick={() => {
            actions.addSibling(id);
            useUiStore.getState().setNodeDrawerOpen(true);
          }}>
          <Plus />
        </ToolButton>
      )}
      {a.changeKind && (
        <Segmented
          ariaLabel="Type de nœud"
          size="xs"
          className="mx-0.5"
          value={a.kind}
          options={kindOptions(a.leafDisabled)}
          onChange={(kind) => actions.setKind(id, kind)}
        />
      )}
      {a.optionalAvailable && (
        <ToolButton
          label={a.optional ? 'Rendre obligatoire' : 'Rendre optionnel'}
          aria-pressed={a.optional}
          className={cn('w-auto gap-1 px-2 text-xs', a.optional && 'bg-accent text-primary')}
          onClick={() => actions.setOptional(id, !a.optional)}
        >
          <CircleDashed /> Optionnel
        </ToolButton>
      )}
      {a.collapseAvailable && (
        <ToolButton label={a.collapsed ? 'Déplier' : 'Replier'} shortcut="Espace" onClick={() => actions.toggleCollapse(id)}>
          {a.collapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
        </ToolButton>
      )}
      {a.rename && (
        <ToolButton label="Renommer" shortcut="F2" onClick={() => actions.startRename(id)}>
          <PencilLine />
        </ToolButton>
      )}
      {a.remove && (
        <ToolButton label="Supprimer" shortcut="Suppr" className="text-destructive hover:text-destructive" onClick={() => actions.requestDelete(id)}>
          <Trash2 />
        </ToolButton>
      )}
    </>
  );
}

export function FloatingToolbar() {
  const { tree, readOnly, undo } = useDocContext();
  const tableOpen = useUiStore((s) => s.tableOpen);
  const setTableOpen = useUiStore((s) => s.setTableOpen);
  const setCriteriaOpen = useUiStore((s) => s.setCriteriaOpen);
  const leftOpen = useUiStore((s) => s.historyOpen);
  const rightOpen = useUiStore((s) => s.nodeDrawerOpen);
  const criteriaCount = tree.criteria.length;

  return (
    // Centred in the part of the canvas that the drawers leave free.
    <div
      className="pointer-events-none absolute bottom-4 z-20 flex justify-center px-3"
      style={{ left: leftOpen ? DRAWER_ROOM : 0, right: rightOpen ? DRAWER_ROOM : 0 }}
    >
      <div
        role="toolbar"
        aria-label="Barre d’outils"
        className="fc-overlay pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-xl border bg-card/95 p-1 text-card-foreground shadow-lg backdrop-blur"
      >
        {!readOnly && (
          <>
            <ToolButton label="Annuler" shortcut="Ctrl Z" disabled={!undo.canUndo} onClick={undo.undo}>
              <Undo2 />
            </ToolButton>
            <ToolButton label="Rétablir" shortcut="Ctrl Maj Z" disabled={!undo.canRedo} onClick={undo.redo}>
              <Redo2 />
            </ToolButton>
          </>
        )}
        <NodeSection />
        <Divider />
        <ToolButton label="Gérer les critères" className="relative w-auto gap-1.5 px-2 text-xs" onClick={() => setCriteriaOpen(true)}>
          <SlidersHorizontal /> Critères
          <span
            className={cn(
              'absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
              criteriaCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {criteriaCount}
          </span>
        </ToolButton>
        <ToolButton
          label={tableOpen ? 'Masquer la comparaison' : 'Comparer les configurations'}
          aria-pressed={tableOpen}
          className={cn('w-auto gap-1.5 px-2 text-xs', tableOpen && 'bg-accent text-primary')}
          onClick={() => setTableOpen(!tableOpen)}
        >
          <Table2 /> Comparer
        </ToolButton>
        <ExportMenu />
      </div>
    </div>
  );
}
