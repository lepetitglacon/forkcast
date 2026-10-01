import type { ReactNode } from 'react';
import { History, SquarePen, X } from 'lucide-react';
import { useDocContext } from '@/docs/DocContext';
import { useUiStore } from '@/store/ui';
import { cn } from '@/lib/utils';
import { HistoryPanel } from '@/components/history/HistoryPanel';
import { NodeDetails } from '@/components/panels/NodeDetails';
import { TreeOverview } from '@/components/panels/TreeOverview';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { DRAWER_WIDTH_REM, type DrawerSide } from './drawer';

interface InsetDrawerProps {
  side: DrawerSide;
  title: ReactNode;
  icon: ReactNode;
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Figma-like inset drawer: full height of the workspace, detached from the edges, rounded.
 * The canvas stays interactive around it. `data-drawer` lets the reveal logic avoid it.
 */
function InsetDrawer({ side, title, icon, label, onClose, children }: InsetDrawerProps) {
  return (
    <aside
      aria-label={label}
      data-drawer={side}
      className={cn(
        'fc-overlay pointer-events-auto absolute top-2 bottom-2 z-20 flex max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl',
        side === 'left' ? 'left-2' : 'right-2',
      )}
      style={{ width: `${DRAWER_WIDTH_REM}rem` }}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</div>
        <Hint label="Fermer">
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label={`Fermer : ${label}`}>
            <X />
          </Button>
        </Hint>
      </header>
      {children}
    </aside>
  );
}

/** Right drawer: details of the selected node (tree overview when nothing is selected). */
export function NodeDrawer() {
  const { tree } = useDocContext();
  const selectedId = useUiStore((s) => s.selectedId);
  const setOpen = useUiStore((s) => s.setNodeDrawerOpen);
  const node = selectedId ? tree.nodes[selectedId] : undefined;
  return (
    <InsetDrawer
      side="right"
      label="Détails du nœud"
      icon={<SquarePen />}
      title={node ? 'Nœud' : 'Arbre'}
      onClose={() => setOpen(false)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {node ? <NodeDetails key={node.id} nodeId={node.id} /> : <TreeOverview />}
      </div>
    </InsetDrawer>
  );
}

/** Left drawer: history of the whole tree, or of the selected node only. */
export function HistoryDrawer() {
  const setOpen = useUiStore((s) => s.setHistoryOpen);
  const selectedId = useUiStore((s) => s.selectedId);
  return (
    <InsetDrawer side="left" label="Historique" icon={<History />} title="Historique" onClose={() => setOpen(false)}>
      {/* keyed by scope so that pagination restarts when the selection changes */}
      <HistoryPanel key={selectedId ?? 'tree'} />
    </InsetDrawer>
  );
}
