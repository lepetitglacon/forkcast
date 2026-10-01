import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import type { NodeKind, Tree } from '@forkcast/shared';
import { DESTRUCTIVE_CONFIRM_THRESHOLD } from '@forkcast/shared';
import { isAncestor, subtreeIds } from '@forkcast/doc';
import { toast } from 'sonner';
import type { NavigateDirection } from '@/lib/orientation';
import { EMPTY_IDS, useUiStore, type XY } from '@/store/ui';
import { useDocContext } from './DocContext';

export const NEW_NODE_LABEL = 'Nouveau nœud';

export interface NodeActions {
  select: (id: string | null) => void;
  /** Add a child (and start renaming it). In free-move mode `position` pins the new card. */
  addChild: (parentId: string, options?: { position?: XY }) => string | null;
  addSibling: (id: string) => string | null;
  startRename: (id: string) => void;
  commitRename: (id: string, label: string) => void;
  cancelRename: () => void;
  /** Delete, after a confirmation when the branch is large. */
  requestDelete: (id: string) => void;
  deleteNow: (id: string) => void;
  toggleCollapse: (id: string) => void;
  setCollapsed: (id: string, collapsed: boolean) => void;
  expandAll: () => void;
  collapseToDepth: (depth: number) => void;
  setKind: (id: string, kind: NodeKind) => void;
  setOptional: (id: string, optional: boolean) => void;
  /** Re-parent `id` under `parentId` (validated); returns true when the move happened. */
  moveNode: (id: string, parentId: string) => boolean;
  navigate: (direction: NavigateDirection) => void;
  /** Make nodes visible (expand collapsed ancestors). */
  reveal: (ids: readonly string[]) => void;
  undo: () => void;
  redo: () => void;
}

export const NodeActionsContext = createContext<NodeActions | null>(null);

export function useNodeActions(): NodeActions {
  const actions = useContext(NodeActionsContext);
  if (!actions) throw new Error('useNodeActions doit être utilisé dans un éditeur');
  return actions;
}

function siblingsOf(tree: Tree, id: string): string[] {
  const parentId = tree.nodes[id]?.parentId;
  if (parentId === null || parentId === undefined) return [id];
  return tree.children[parentId] ?? [id];
}

function ancestorsOf(tree: Tree, id: string): string[] {
  const out: string[] = [];
  let cur = tree.nodes[id]?.parentId;
  while (cur) {
    out.push(cur);
    cur = tree.nodes[cur]?.parentId;
  }
  return out;
}

/** Builds the (stable) set of editing actions shared by keyboard, toolbar, menus and cards. */
export function useCreateNodeActions(): NodeActions {
  const { tree, treeKey, exec, undo } = useDocContext();
  const treeRef = useRef(tree);
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  return useMemo<NodeActions>(() => {
    const store = useUiStore;
    const collapsedIds = () => store.getState().collapsed[treeKey] ?? EMPTY_IDS;
    const expand = (id: string) => {
      if (collapsedIds().includes(id)) store.getState().setCollapsed(treeKey, id, false);
    };
    const select = (id: string | null) => store.getState().select(id);
    const startRename = (id: string) => store.getState().setRenaming(id);

    const deleteNow = (id: string) => {
      const t = treeRef.current;
      const parentId = t.nodes[id]?.parentId ?? t.meta.rootId;
      const r = exec<{ removedIds: string[] }>({ type: 'remove', nodeId: id });
      if (!r) return;
      store.getState().setPendingDelete(null);
      store.getState().clearNodePosition(treeKey, id);
      select(parentId);
      const n = r.result.removedIds.length;
      toast.success(n > 1 ? `${n} nœuds supprimés` : 'Nœud supprimé', { description: 'Ctrl + Z pour annuler.' });
    };

    return {
      select,
      addChild: (parentId, options) => {
        const r = exec<{ id: string }>({ type: 'addChild', parentId, node: { label: NEW_NODE_LABEL } });
        if (!r) return null;
        const id = r.result.id;
        expand(parentId);
        if (options?.position) store.getState().setNodePosition(treeKey, id, options.position);
        select(id);
        startRename(id);
        store.getState().requestReveal(id);
        return id;
      },
      addSibling: (id) => {
        if (id === treeRef.current.meta.rootId) {
          toast.error('La racine ne peut pas avoir de frère');
          return null;
        }
        const r = exec<{ id: string }>({ type: 'addSibling', siblingId: id, node: { label: NEW_NODE_LABEL } });
        if (!r) return null;
        select(r.result.id);
        startRename(r.result.id);
        store.getState().requestReveal(r.result.id);
        return r.result.id;
      },
      startRename,
      commitRename: (id, label) => {
        store.getState().setRenaming(null);
        const current = treeRef.current.nodes[id];
        if (!current) return;
        const trimmed = label.trim();
        const next = trimmed.length > 0 ? trimmed : current.label || NEW_NODE_LABEL;
        if (next === current.label) return;
        exec({ type: 'rename', nodeId: id, label: next });
      },
      cancelRename: () => store.getState().setRenaming(null),
      requestDelete: (id) => {
        const t = treeRef.current;
        if (id === t.meta.rootId) {
          toast.error('La racine ne peut pas être supprimée');
          return;
        }
        if (subtreeIds(t, id).length > DESTRUCTIVE_CONFIRM_THRESHOLD) store.getState().setPendingDelete(id);
        else deleteNow(id);
      },
      deleteNow,
      toggleCollapse: (id) => {
        if ((treeRef.current.children[id] ?? []).length === 0) return;
        store.getState().toggleCollapsed(treeKey, id);
      },
      setCollapsed: (id, collapsed) => store.getState().setCollapsed(treeKey, id, collapsed),
      expandAll: () => store.getState().setCollapsedIds(treeKey, []),
      collapseToDepth: (depth) => {
        const t = treeRef.current;
        const ids: string[] = [];
        const visit = (id: string, d: number) => {
          const kids = t.children[id] ?? [];
          if (kids.length === 0) return;
          if (d >= depth) ids.push(id);
          for (const k of kids) visit(k, d + 1);
        };
        if (t.meta.rootId) visit(t.meta.rootId, 0);
        store.getState().setCollapsedIds(treeKey, ids);
      },
      setKind: (id, kind) => {
        if (treeRef.current.nodes[id]?.kind === kind) return;
        exec({ type: 'setKind', nodeId: id, kind });
      },
      setOptional: (id, optional) => {
        if ((treeRef.current.nodes[id]?.optional === true) === optional) return;
        exec({ type: 'setOptional', nodeId: id, optional });
      },
      moveNode: (id, parentId) => {
        const t = treeRef.current;
        if (id === parentId || !t.nodes[id] || !t.nodes[parentId]) return false;
        if (id === t.meta.rootId) {
          toast.error('La racine ne peut pas être déplacée');
          return false;
        }
        if (t.nodes[id]?.parentId === parentId) return false;
        if (isAncestor(t, id, parentId)) {
          toast.error('Déplacement impossible', { description: 'Un nœud ne peut pas être déplacé dans sa propre branche.' });
          return false;
        }
        if (!exec({ type: 'move', nodeId: id, parentId })) return false;
        expand(parentId);
        // The card follows its new parent in the layout (free-move position dropped).
        store.getState().clearNodePosition(treeKey, id);
        select(id);
        return true;
      },
      navigate: (direction) => {
        const t = treeRef.current;
        const current = store.getState().selectedId;
        if (!current || !t.nodes[current]) {
          if (t.meta.rootId) select(t.meta.rootId);
          return;
        }
        if (direction === 'parent') {
          const parentId = t.nodes[current]?.parentId;
          if (parentId) select(parentId);
          return;
        }
        if (direction === 'child') {
          const first = (t.children[current] ?? [])[0];
          if (!first) return;
          expand(current);
          select(first);
          return;
        }
        const siblings = siblingsOf(t, current);
        const index = siblings.indexOf(current);
        const target = siblings[direction === 'next' ? index + 1 : index - 1];
        if (target) select(target);
      },
      reveal: (ids) => {
        const t = treeRef.current;
        const collapsed = new Set(collapsedIds());
        let changed = false;
        for (const id of ids) {
          for (const a of ancestorsOf(t, id)) {
            if (collapsed.delete(a)) changed = true;
          }
        }
        if (changed) store.getState().setCollapsedIds(treeKey, [...collapsed]);
      },
      undo: undo.undo,
      redo: undo.redo,
    };
  }, [treeKey, exec, undo.undo, undo.redo]);
}
