import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useConnection,
  useReactFlow,
  useUpdateNodeInternals,
  type FinalConnectionState,
  type NodeChange,
  type NodeMouseHandler,
  type OnNodeDrag,
} from '@xyflow/react';
import { useDocContext } from '@/docs/DocContext';
import { useAggregates } from '@/docs/useAggregates';
import { useNodeActions } from '@/docs/useNodeActions';
import { usePresence, type PresenceUser } from '@/docs/usePresence';
import { EMPTY_IDS, EMPTY_POSITIONS, useUiStore } from '@/store/ui';
import { AppearanceCard } from '@/components/editor/AppearanceCard';
import { DRAWER_ROOM } from '@/components/editor/drawer';
import { useResolvedTheme } from '@/store/theme';
import { cn } from '@/lib/utils';
import { markConnectEnd } from './connectState';
import { PresenceLayer } from './PresenceLayer';
import { TreeNodeView } from './TreeNodeView';
import { useFitTo, useRevealNode } from './useFitTo';
import { buildFlowEdges, buildFlowNodes, type FlowNode } from './nodeData';
import {
  applyFreePositions,
  DEFAULT_NODE_HEIGHT,
  GRID_SIZE,
  NODE_WIDTH,
  snapToGridPoint,
  useLayout,
  type NodeSize,
  type XY,
} from './useLayout';

const NODE_TYPES = { tree: TreeNodeView };
const EMPTY_SET: ReadonlySet<string> = new Set<string>();
const CURSOR_THROTTLE_MS = 40;
const SNAP: [number, number] = [GRID_SIZE, GRID_SIZE];
const FIT_OPTIONS = { padding: 0.2, maxZoom: 1 };

function miniMapColor(node: FlowNode): string {
  if (node.data.isRoot) return 'var(--primary)';
  if (node.data.kind === 'or') return 'var(--or)';
  if (node.data.kind === 'and') return 'var(--and)';
  return 'var(--muted-foreground)';
}

function pointerOf(event: MouseEvent | TouchEvent): XY {
  if ('changedTouches' in event) {
    const t = event.changedTouches[0];
    return { x: t?.clientX ?? 0, y: t?.clientY ?? 0 };
  }
  return { x: event.clientX, y: event.clientY };
}

export function TreeCanvas() {
  const { tree, treeKey, readOnly, awareness } = useDocContext();
  const actions = useNodeActions();
  const aggregates = useAggregates(tree);
  const theme = useResolvedTheme();
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow<FlowNode>();
  const fitTo = useFitTo();
  const revealNode = useRevealNode();
  const updateNodeInternals = useUpdateNodeInternals();

  const collapsedIds = useUiStore((s) => s.collapsed[treeKey]) ?? EMPTY_IDS;
  const storedPositions = useUiStore((s) => s.positions[treeKey]) ?? EMPTY_POSITIONS;
  const selectedId = useUiStore((s) => s.selectedId);
  const renamingId = useUiStore((s) => s.renamingId);
  const highlightedIds = useUiStore((s) => s.highlightedNodeIds);
  const aiHighlight = useUiStore((s) => s.aiHighlight);
  const sketch = useUiStore((s) => s.sketch);
  const orientation = useUiStore((s) => s.orientation);
  const freeMove = useUiStore((s) => s.freeMove);
  const snapToGrid = useUiStore((s) => s.snapToGrid);
  const leftDrawerOpen = useUiStore((s) => s.historyOpen);
  const rightDrawerOpen = useUiStore((s) => s.nodeDrawerOpen);
  const pendingReveal = useUiStore((s) => s.pendingReveal);
  const connecting = useConnection((c) => c.inProgress);
  const presence = usePresence(awareness);

  const [measured, setMeasured] = useState<Record<string, NodeSize>>({});
  const [drag, setDrag] = useState<{ id: string; position: XY } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [nodeCache] = useState(() => new Map<string, FlowNode>());
  const dropTargetRef = useRef<string | null>(null);
  const lastCursorAt = useRef(0);
  const fittedRef = useRef(false);
  const nodeIdsRef = useRef<string[]>([]);
  const orientationRef = useRef(orientation);

  const collapsed = useMemo(() => new Set(collapsedIds), [collapsedIds]);
  const highlighted = useMemo(() => (highlightedIds.length ? new Set(highlightedIds) : EMPTY_SET), [highlightedIds]);
  const aiHighlighted = useMemo(() => {
    const ids = Object.keys(aiHighlight);
    return ids.length ? new Set(ids) : EMPTY_SET;
  }, [aiHighlight]);
  const presenceByNode = useMemo(() => {
    const map = new Map<string, PresenceUser[]>();
    for (const p of presence) {
      if (!p.selection) continue;
      const list = map.get(p.selection) ?? [];
      list.push(p.user);
      map.set(p.selection, list);
    }
    return map;
  }, [presence]);

  const autoLayout = useLayout(tree, collapsed, measured, orientation);
  const layout = useMemo(() => {
    if (!freeMove) return autoLayout;
    // While dragging in free mode the card (and its auto-laid-out subtree) follows the pointer.
    const stored = drag ? { ...storedPositions, [drag.id]: drag.position } : storedPositions;
    return applyFreePositions(autoLayout, tree, stored);
  }, [autoLayout, freeMove, drag, storedPositions, tree]);

  const nodes = useMemo(
    () =>
      buildFlowNodes(
        {
          tree,
          layout,
          aggregates,
          measured,
          dragPosition: freeMove ? null : drag,
          selectedId,
          renamingId,
          highlighted,
          aiHighlighted,
          dropTargetId,
          presenceByNode,
          readOnly,
          sketch,
          freeMove,
          orientation,
        },
        nodeCache,
      ),
    [
      tree,
      layout,
      aggregates,
      measured,
      freeMove,
      drag,
      selectedId,
      renamingId,
      highlighted,
      aiHighlighted,
      dropTargetId,
      presenceByNode,
      readOnly,
      sketch,
      orientation,
      nodeCache,
    ],
  );
  const edges = useMemo(() => buildFlowEdges(layout, highlighted), [layout, highlighted]);

  useEffect(() => {
    nodeIdsRef.current = nodes.map((n) => n.id);
  }, [nodes]);

  // The initial fitView runs before the cards are measured (the layout then grows with the
  // real heights): fit once more as soon as every visible card has been measured.
  useEffect(() => {
    if (fittedRef.current || layout.nodes.length === 0) return;
    if (!layout.nodes.every((n) => measured[n.id] !== undefined)) return;
    fittedRef.current = true;
    fitTo(undefined, FIT_OPTIONS);
  }, [layout, measured, fitTo]);

  // Orientation change: handles moved to other sides → re-measure them, then re-fit.
  // (Effects of the React Flow children already pushed the new positions to its store.)
  useEffect(() => {
    if (orientationRef.current === orientation) return;
    orientationRef.current = orientation;
    updateNodeInternals(nodeIdsRef.current);
    const timer = setTimeout(() => fitTo(undefined, { ...FIT_OPTIONS, duration: 250 }), 30);
    return () => clearTimeout(timer);
  }, [orientation, updateNodeInternals, fitTo]);

  // A new card is brought into view once laid out and measured (or after a short delay).
  useEffect(() => {
    if (!pendingReveal) return;
    const id = pendingReveal;
    const ready = measured[id] !== undefined && layout.nodes.some((n) => n.id === id);
    const timer = setTimeout(() => {
      if (revealNode(id)) useUiStore.getState().clearReveal(id);
    }, ready ? 30 : 400);
    return () => clearTimeout(timer);
  }, [pendingReveal, measured, layout, revealNode]);

  // Presence: share the selection with the other participants.
  useEffect(() => {
    awareness?.setLocalStateField('selection', selectedId);
  }, [awareness, selectedId]);

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      let sizes: Record<string, NodeSize> | null = null;
      let dragged: { id: string; position: XY } | null = null;
      let selectId: string | null | undefined;
      const deselected: string[] = [];
      for (const change of changes) {
        if (change.type === 'dimensions' && change.dimensions) {
          (sizes ??= {})[change.id] = { width: change.dimensions.width, height: change.dimensions.height };
        } else if (change.type === 'position' && change.position && change.dragging) {
          dragged = { id: change.id, position: change.position };
        } else if (change.type === 'select') {
          if (change.selected) selectId = change.id;
          else deselected.push(change.id);
        }
      }
      if (sizes) {
        const next = sizes;
        setMeasured((prev) => {
          let changed = false;
          const out = { ...prev };
          for (const [id, size] of Object.entries(next)) {
            const cur = prev[id];
            if (!cur || cur.width !== size.width || cur.height !== size.height) {
              out[id] = size;
              changed = true;
            }
          }
          return changed ? out : prev;
        });
      }
      if (dragged) setDrag(dragged);
      if (selectId !== undefined) actions.select(selectId);
      else if (deselected.includes(useUiStore.getState().selectedId ?? '')) actions.select(null);
    },
    [actions],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler<FlowNode>>(
    (_event, node) => {
      if (!readOnly) actions.startRename(node.id);
    },
    [actions, readOnly],
  );

  /** The card under the centre of the dragged card (null when none). */
  const findDropTarget = useCallback(
    (node: FlowNode): string | null => {
      const width = node.measured?.width ?? NODE_WIDTH;
      const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
      const cx = node.position.x + width / 2;
      const cy = node.position.y + height / 2;
      const probe = { x: cx - 1, y: cy - 1, width: 2, height: 2 };
      for (const candidate of getIntersectingNodes(probe)) {
        if (candidate.id !== node.id) return candidate.id;
      }
      return null;
    },
    [getIntersectingNodes],
  );

  const canReparent = !readOnly;

  const onNodeDrag = useCallback<OnNodeDrag<FlowNode>>(
    (_event, node) => {
      const target = canReparent && node.id !== tree.meta.rootId ? findDropTarget(node) : null;
      if (target !== dropTargetRef.current) {
        dropTargetRef.current = target;
        setDropTargetId(target);
      }
    },
    [findDropTarget, canReparent, tree.meta.rootId],
  );

  const onNodeDragStop = useCallback<OnNodeDrag<FlowNode>>(
    (_event, node) => {
      const target = canReparent && node.id !== tree.meta.rootId ? findDropTarget(node) : null;
      dropTargetRef.current = null;
      setDropTargetId(null);
      setDrag(null);
      if (target) {
        actions.moveNode(node.id, target); // validated, toast when refused; snaps back otherwise
        return;
      }
      if (freeMove) useUiStore.getState().setNodePosition(treeKey, node.id, node.position);
    },
    [actions, findDropTarget, canReparent, freeMove, treeKey, tree.meta.rootId],
  );

  /** End of a drag started from the "+" handle of `fromNode`. */
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      const sourceId = state.fromNode?.id;
      if (!sourceId || readOnly) return;
      markConnectEnd();
      const point = pointerOf(event);
      const under = document.elementFromPoint(point.x, point.y);
      if (!under?.closest('.react-flow')) return; // released over a floating panel
      const targetId = under.closest('.react-flow__node')?.getAttribute('data-id') ?? null;
      if (targetId && targetId !== sourceId) {
        actions.moveNode(targetId, sourceId);
        return;
      }
      let position: XY | undefined;
      if (!targetId && freeMove) {
        const flow = screenToFlowPosition(point);
        const corner = { x: flow.x - NODE_WIDTH / 2, y: flow.y - DEFAULT_NODE_HEIGHT / 2 };
        position = snapToGrid ? snapToGridPoint(corner) : corner;
      }
      actions.select(sourceId);
      actions.addChild(sourceId, position ? { position } : undefined);
      useUiStore.getState().setNodeDrawerOpen(true);
    },
    [actions, freeMove, readOnly, screenToFlowPosition, snapToGrid],
  );

  const onNodeClick = useCallback<NodeMouseHandler<FlowNode>>(() => {
    useUiStore.getState().setNodeDrawerOpen(true);
  }, []);

  const onPaneClick = useCallback(() => {
    actions.select(null);
    useUiStore.getState().setNodeDrawerOpen(false);
  }, [actions]);

  const onMouseMove = useCallback(
    (event: ReactMouseEvent) => {
      if (!awareness) return;
      const now = performance.now();
      if (now - lastCursorAt.current < CURSOR_THROTTLE_MS) return;
      lastCursorAt.current = now;
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      awareness.setLocalStateField('cursor', { x: Math.round(pos.x), y: Math.round(pos.y) });
    },
    [awareness, screenToFlowPosition],
  );

  const onMouseLeave = useCallback(() => {
    awareness?.setLocalStateField('cursor', null);
  }, [awareness]);

  return (
    <div className={cn('h-full w-full', connecting && 'fc-connecting')} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <ReactFlow<FlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick}
        colorMode={theme}
        fitView
        fitViewOptions={FIT_OPTIONS}
        minZoom={0.1}
        maxZoom={2}
        nodesConnectable={!readOnly}
        connectOnClick={false}
        connectionDragThreshold={5}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ stroke: 'var(--primary)', strokeWidth: 2, strokeDasharray: '6 4' }}
        snapToGrid={snapToGrid}
        snapGrid={SNAP}
        edgesFocusable={false}
        elementsSelectable
        selectNodesOnDrag={false}
        nodeDragThreshold={6}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        panActivationKeyCode={null}
        zoomOnDoubleClick={false}
        disableKeyboardA11y
        nodesFocusable={false}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        {snapToGrid && <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1.2} />}
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          style={{ marginRight: rightDrawerOpen ? DRAWER_ROOM : 15 }}
          nodeColor={miniMapColor}
          nodeStrokeWidth={2}
          className="fc-overlay !bg-card"
        />
        {/* Appearance card stacked above the zoom controls (two separate elements). */}
        <Panel position="bottom-left" className="flex flex-col items-start gap-2" style={{ marginLeft: leftDrawerOpen ? DRAWER_ROOM : 15 }}>
          <div className="fc-overlay">
            <AppearanceCard />
          </div>
          <Controls showInteractive={false} className="fc-overlay" style={{ position: 'static', margin: 0 }} />
        </Panel>
        <PresenceLayer presence={presence} />
      </ReactFlow>
    </div>
  );
}
