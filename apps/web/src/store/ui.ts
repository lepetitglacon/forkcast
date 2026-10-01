import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Orientation } from '@/lib/orientation';
import type { HistoryFilter } from '@/lib/history';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface XY {
  x: number;
  y: number;
}

export interface UiState {
  // ---- persisted view preferences ----
  theme: ThemeMode;
  sketch: boolean;
  orientation: Orientation;
  freeMove: boolean;
  snapToGrid: boolean;
  /** Appearance card folded to a small button. */
  appearanceCollapsed: boolean;
  /** History drawer (left). */
  historyOpen: boolean;
  tableOpen: boolean;
  /** Collapsed node ids per tree key. */
  collapsed: Record<string, string[]>;
  /** Free-move card positions per tree key (view state, never in the document). */
  positions: Record<string, Record<string, XY>>;
  /** Last activity entry id seen per tree key (assistant notifications). */
  lastSeenActivity: Record<string, string>;

  // ---- transient editor state ----
  selectedId: string | null;
  renamingId: string | null;
  highlightedNodeIds: string[];
  highlightedKey: string | null;
  /** Node id → timestamp until which the "modified by the assistant" highlight is shown. */
  aiHighlight: Record<string, number>;
  pendingDeleteId: string | null;
  helpOpen: boolean;
  aboutOpen: boolean;
  criteriaOpen: boolean;
  /** Node drawer (right): opened by a click on a card, closed by a click on the empty canvas. */
  nodeDrawerOpen: boolean;
  historyFilter: HistoryFilter;
  /** Card to bring into view once laid out (set when a card is created). */
  pendingReveal: string | null;

  setTheme: (theme: ThemeMode) => void;
  setSketch: (sketch: boolean) => void;
  setOrientation: (orientation: Orientation) => void;
  setFreeMove: (freeMove: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setAppearanceCollapsed: (collapsed: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  setNodeDrawerOpen: (open: boolean) => void;
  setTableOpen: (open: boolean) => void;
  toggleCollapsed: (treeKey: string, nodeId: string) => void;
  setCollapsed: (treeKey: string, nodeId: string, collapsed: boolean) => void;
  setCollapsedIds: (treeKey: string, ids: string[]) => void;
  setNodePosition: (treeKey: string, nodeId: string, position: XY) => void;
  clearNodePosition: (treeKey: string, nodeId: string) => void;
  clearPositions: (treeKey: string) => void;
  select: (id: string | null) => void;
  setRenaming: (id: string | null) => void;
  setHighlight: (ids: string[], key: string | null) => void;
  clearHighlight: () => void;
  addAiHighlight: (ids: string[], until: number) => void;
  pruneAiHighlight: (now: number) => void;
  setLastSeen: (treeKey: string, entryId: string) => void;
  setPendingDelete: (id: string | null) => void;
  setHelpOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setCriteriaOpen: (open: boolean) => void;
  setHistoryFilter: (filter: HistoryFilter) => void;
  requestReveal: (id: string) => void;
  clearReveal: (id: string) => void;
  resetTransient: () => void;
}

type PersistedUi = Pick<
  UiState,
  | 'theme'
  | 'sketch'
  | 'orientation'
  | 'freeMove'
  | 'snapToGrid'
  | 'appearanceCollapsed'
  | 'historyOpen'
  | 'tableOpen'
  | 'collapsed'
  | 'positions'
  | 'lastSeenActivity'
>;

export const EMPTY_IDS: string[] = [];
export const EMPTY_POSITIONS: Record<string, XY> = {};

const TRANSIENT = {
  selectedId: null,
  renamingId: null,
  highlightedNodeIds: EMPTY_IDS,
  highlightedKey: null,
  aiHighlight: {},
  pendingDeleteId: null,
  helpOpen: false,
  aboutOpen: false,
  criteriaOpen: false,
  nodeDrawerOpen: false,
  pendingReveal: null,
} satisfies Partial<UiState>;

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      sketch: false,
      orientation: 'lr',
      freeMove: false,
      snapToGrid: true,
      appearanceCollapsed: true,
      historyOpen: false,
      tableOpen: false,
      collapsed: {},
      positions: {},
      lastSeenActivity: {},

      ...TRANSIENT,
      historyFilter: 'all',

      setTheme: (theme) => set({ theme }),
      setSketch: (sketch) => set({ sketch }),
      setOrientation: (orientation) => set({ orientation }),
      setFreeMove: (freeMove) => set({ freeMove }),
      setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
      setAppearanceCollapsed: (appearanceCollapsed) => set({ appearanceCollapsed }),
      setHistoryOpen: (historyOpen) => set({ historyOpen }),
      setNodeDrawerOpen: (nodeDrawerOpen) => set({ nodeDrawerOpen }),
      setTableOpen: (tableOpen) => set({ tableOpen }),
      toggleCollapsed: (treeKey, nodeId) =>
        set((s) => {
          const current = s.collapsed[treeKey] ?? EMPTY_IDS;
          const next = current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId];
          return { collapsed: { ...s.collapsed, [treeKey]: next } };
        }),
      setCollapsed: (treeKey, nodeId, collapsed) =>
        set((s) => {
          const current = s.collapsed[treeKey] ?? EMPTY_IDS;
          if (current.includes(nodeId) === collapsed) return {};
          const next = collapsed ? [...current, nodeId] : current.filter((id) => id !== nodeId);
          return { collapsed: { ...s.collapsed, [treeKey]: next } };
        }),
      setCollapsedIds: (treeKey, ids) => set((s) => ({ collapsed: { ...s.collapsed, [treeKey]: ids } })),
      setNodePosition: (treeKey, nodeId, position) =>
        set((s) => ({
          positions: {
            ...s.positions,
            [treeKey]: { ...(s.positions[treeKey] ?? EMPTY_POSITIONS), [nodeId]: { x: Math.round(position.x), y: Math.round(position.y) } },
          },
        })),
      clearNodePosition: (treeKey, nodeId) =>
        set((s) => {
          const current = s.positions[treeKey];
          if (!current || !(nodeId in current)) return {};
          const next = { ...current };
          delete next[nodeId];
          return { positions: { ...s.positions, [treeKey]: next } };
        }),
      clearPositions: (treeKey) =>
        set((s) => {
          if (!s.positions[treeKey]) return {};
          const next = { ...s.positions };
          delete next[treeKey];
          return { positions: next };
        }),
      select: (id) =>
        set((s) => ({
          selectedId: id,
          renamingId: s.renamingId !== null && s.renamingId !== id ? null : s.renamingId,
        })),
      setRenaming: (id) => set((s) => ({ renamingId: id, selectedId: id ?? s.selectedId })),
      setHighlight: (ids, key) => set({ highlightedNodeIds: ids, highlightedKey: key }),
      clearHighlight: () => set({ highlightedNodeIds: EMPTY_IDS, highlightedKey: null }),
      addAiHighlight: (ids, until) =>
        set((s) => {
          const next = { ...s.aiHighlight };
          for (const id of ids) next[id] = Math.max(next[id] ?? 0, until);
          return { aiHighlight: next };
        }),
      pruneAiHighlight: (now) =>
        set((s) => {
          const next: Record<string, number> = {};
          let changed = false;
          for (const [id, until] of Object.entries(s.aiHighlight)) {
            if (until > now) next[id] = until;
            else changed = true;
          }
          return changed ? { aiHighlight: next } : {};
        }),
      setLastSeen: (treeKey, entryId) =>
        set((s) =>
          s.lastSeenActivity[treeKey] === entryId ? {} : { lastSeenActivity: { ...s.lastSeenActivity, [treeKey]: entryId } },
        ),
      setPendingDelete: (pendingDeleteId) => set({ pendingDeleteId }),
      setHelpOpen: (helpOpen) => set({ helpOpen }),
      setAboutOpen: (aboutOpen) => set({ aboutOpen }),
      setCriteriaOpen: (criteriaOpen) => set({ criteriaOpen }),
      setHistoryFilter: (historyFilter) => set({ historyFilter }),
      requestReveal: (pendingReveal) => set({ pendingReveal }),
      clearReveal: (id) => set((s) => (s.pendingReveal === id ? { pendingReveal: null } : {})),
      resetTransient: () => set({ ...TRANSIENT }),
    }),
    {
      name: 'forkcast:ui',
      version: 4,
      migrate: (persisted) => {
        // v1: panelOpen/panelTab; v2: detailsOpen; v3: drawer ('details' | 'history').
        const old = (persisted ?? {}) as Record<string, unknown>;
        const { panelOpen: _p, panelTab: _t, detailsOpen: _d, drawer, ...rest } = old;
        // v4: the appearance card starts collapsed once for everybody; later choices persist.
        // Missing keys are filled with the defaults by the (shallow) merge of `persist`.
        return { ...rest, historyOpen: drawer === 'history', appearanceCollapsed: true } as PersistedUi;
      },
      partialize: (s): PersistedUi => ({
        theme: s.theme,
        sketch: s.sketch,
        orientation: s.orientation,
        freeMove: s.freeMove,
        snapToGrid: s.snapToGrid,
        appearanceCollapsed: s.appearanceCollapsed,
        historyOpen: s.historyOpen,
        tableOpen: s.tableOpen,
        collapsed: s.collapsed,
        positions: s.positions,
        lastSeenActivity: s.lastSeenActivity,
      }),
    },
  ),
);
