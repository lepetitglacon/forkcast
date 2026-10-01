import { useCallback } from 'react';
import { getViewportForBounds, useReactFlow, useStoreApi } from '@xyflow/react';
import { animationDuration } from '@/lib/utils';

export interface FitToOptions {
  padding?: number;
  maxZoom?: number;
  /** Animation in ms (skipped when the page is hidden). */
  duration?: number;
}

/**
 * Fit the viewport to some cards (all by default). Unlike `fitView`, which React Flow
 * defers to the next animation frame, the viewport is computed and applied right away.
 */
export function useFitTo(): (nodeIds?: readonly string[], options?: FitToOptions) => void {
  const { getNodes, getNodesBounds, setViewport } = useReactFlow();
  const store = useStoreApi();
  return useCallback(
    (nodeIds, options = {}) => {
      const ids = nodeIds ?? getNodes().map((n) => n.id);
      if (ids.length === 0) return;
      const { width, height, minZoom, maxZoom } = store.getState();
      if (!width || !height) return;
      const bounds = getNodesBounds([...ids]);
      if (!Number.isFinite(bounds.width) || bounds.width <= 0) return;
      const viewport = getViewportForBounds(bounds, width, height, minZoom, Math.min(options.maxZoom ?? 1, maxZoom), options.padding ?? 0.2);
      void setViewport(viewport, { duration: animationDuration(options.duration ?? 0) });
    },
    [getNodes, getNodesBounds, setViewport, store],
  );
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Below this zoom a card is hard to read: revealing it zooms in. */
const MIN_READABLE_ZOOM = 0.55;
const REVEAL_ZOOM = 0.85;
const MARGIN = 20;

/**
 * Make a card fully visible: inside the canvas and not under the floating panels (drawer,
 * toolbar, appearance card, controls, minimap — elements marked `.fc-overlay`). Pans as
 * little as possible, re-centres when a pan is not enough. Returns false when the card is
 * not rendered yet.
 */
export function useRevealNode(): (nodeId: string) => boolean {
  const { getInternalNode, getViewport, setViewport } = useReactFlow();
  const store = useStoreApi();
  return useCallback(
    (nodeId) => {
      const node = getInternalNode(nodeId);
      const domNode = store.getState().domNode;
      if (!node || !domNode) return false;
      const container = domNode.getBoundingClientRect();
      const { x: vx, y: vy, zoom: currentZoom } = getViewport();
      const w = node.measured.width ?? node.width ?? 240;
      const h = node.measured.height ?? node.height ?? 64;
      const { x: px, y: py } = node.internals.positionAbsolute;
      const boxAt = (x: number, y: number, zoom: number): Box => ({
        left: container.left + x + px * zoom - MARGIN,
        top: container.top + y + py * zoom - MARGIN,
        right: container.left + x + (px + w) * zoom + MARGIN,
        bottom: container.top + y + (py + h) * zoom + MARGIN,
      });
      const leftDrawer = document.querySelector('[data-drawer="left"]')?.getBoundingClientRect();
      const rightDrawer = document.querySelector('[data-drawer="right"]')?.getBoundingClientRect();
      const toolbar = document.querySelector('[role="toolbar"]')?.getBoundingClientRect();
      const free: Box = {
        left: leftDrawer && leftDrawer.width > 0 ? Math.max(container.left, leftDrawer.right) : container.left,
        top: container.top,
        right: rightDrawer && rightDrawer.width > 0 ? Math.min(container.right, rightDrawer.left) : container.right,
        bottom: toolbar && toolbar.height > 0 ? Math.min(container.bottom, toolbar.top) : container.bottom,
      };
      const overlays: Box[] = Array.from(document.querySelectorAll('.fc-overlay'))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      const isClear = (b: Box) =>
        b.left >= free.left && b.top >= free.top && b.right <= free.right && b.bottom <= free.bottom && !overlays.some((o) => intersects(o, b));

      const readable = currentZoom >= MIN_READABLE_ZOOM;
      if (readable && isClear(boxAt(vx, vy, currentZoom))) return true;

      const zoom = readable ? currentZoom : REVEAL_ZOOM;
      let x = vx;
      let y = vy;
      if (readable) {
        // smallest pan that brings the card inside the free area
        const b = boxAt(vx, vy, zoom);
        if (b.left < free.left) x += free.left - b.left;
        else if (b.right > free.right) x -= b.right - free.right;
        if (b.top < free.top) y += free.top - b.top;
        else if (b.bottom > free.bottom) y -= b.bottom - free.bottom;
      }
      if (!readable || !isClear(boxAt(x, y, zoom))) {
        // centre the card in the free area
        x = (free.left + free.right) / 2 - container.left - (px + w / 2) * zoom;
        y = (free.top + free.bottom) / 2 - container.top - (py + h / 2) * zoom;
      }
      void setViewport({ x, y, zoom }, { duration: animationDuration(300) });
      return true;
    },
    [getInternalNode, getViewport, setViewport, store],
  );
}
