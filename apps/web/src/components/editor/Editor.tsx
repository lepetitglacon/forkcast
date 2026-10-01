import { useEffect, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { DocContext, useDocContext, type DocContextValue } from '@/docs/DocContext';
import { NodeActionsContext, useCreateNodeActions } from '@/docs/useNodeActions';
import { useAssistantActivity } from '@/docs/useAssistantActivity';
import { useDocWriter } from '@/docs/useDocWriter';
import { useSnapshot } from '@/docs/useSnapshot';
import { useUndoManager } from '@/docs/useUndoManager';
import { useActor } from '@/lib/identity';
import { useUiStore } from '@/store/ui';
import { cn } from '@/lib/utils';
import { TreeCanvas } from '@/components/canvas/TreeCanvas';
import { ComparisonDrawer } from '@/components/table/ComparisonDrawer';
import { AboutDialog } from './AboutDialog';
import { CriteriaDialog } from './CriteriaDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { EditorHeader } from './EditorHeader';
import { FloatingToolbar } from './FloatingToolbar';
import { HelpDialog } from './HelpDialog';
import { HistoryDrawer, NodeDrawer } from './SideDrawer';
import type { SyncInfo } from './SyncStatus';
import { useEditorShortcuts } from './useEditorShortcuts';

export interface EditorProps {
  doc: Y.Doc;
  treeKey: string;
  treeId?: string;
  localId?: string;
  readOnly: boolean;
  sync?: SyncInfo | null;
  awareness?: Awareness | null;
}

export function Editor({ doc, treeKey, treeId, localId, readOnly, sync = null, awareness = null }: EditorProps) {
  const tree = useSnapshot(doc);
  const undo = useUndoManager(doc);
  const actor = useActor();
  const writer = useDocWriter(doc, undo.manager, actor, readOnly);

  const value = useMemo<DocContextValue>(
    () => ({
      ...writer,
      doc,
      tree,
      treeKey,
      treeId: treeId ?? null,
      localId: localId ?? null,
      readOnly,
      actor,
      undo,
      awareness,
    }),
    [writer, doc, tree, treeKey, treeId, localId, readOnly, actor, undo, awareness],
  );

  // Transient view state (selection, highlights…) must not leak between trees.
  useEffect(() => {
    const store = useUiStore.getState();
    store.resetTransient();
    return () => store.resetTransient();
  }, [treeKey]);

  useEffect(() => {
    document.title = `${tree.meta.title || 'Arbre'} — Forkcast`;
  }, [tree.meta.title]);

  useAssistantActivity(doc, treeKey, writer.revert);

  return (
    <DocContext.Provider value={value}>
      <EditorBody sync={sync} />
    </DocContext.Provider>
  );
}

function EditorBody({ sync }: { sync: SyncInfo | null }) {
  const actions = useCreateNodeActions();
  const { readOnly } = useDocContext();
  const sketch = useUiStore((s) => s.sketch);
  const tableOpen = useUiStore((s) => s.tableOpen);
  const nodeDrawerOpen = useUiStore((s) => s.nodeDrawerOpen);
  const historyOpen = useUiStore((s) => s.historyOpen);
  useEditorShortcuts(actions, readOnly);

  return (
    <NodeActionsContext.Provider value={actions}>
      <ReactFlowProvider>
        <div className={cn('flex h-dvh flex-col overflow-hidden', sketch && 'sketch')}>
          <EditorHeader sync={sync} />
          <div className="flex min-h-0 flex-1 flex-col">
            <main className="relative min-h-0 flex-1 bg-canvas">
              <TreeCanvas />
              {nodeDrawerOpen && <NodeDrawer />}
              {historyOpen && <HistoryDrawer />}
              <FloatingToolbar />
            </main>
            {tableOpen && <ComparisonDrawer />}
          </div>
        </div>
        <HelpDialog />
        <AboutDialog />
        <CriteriaDialog />
        <DeleteConfirmDialog />
      </ReactFlowProvider>
    </NodeActionsContext.Provider>
  );
}
