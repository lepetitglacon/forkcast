import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { downloadDataUrl } from '@/lib/utils';

export type ImageFormat = 'png' | 'svg';

const MAX_SIZE = 8000;
const PADDING = 48;

/** Render the whole tree (not only the visible part) to a PNG or SVG file. */
export async function exportCanvasImage(
  format: ImageFormat,
  nodes: Node[],
  filename: string,
  backgroundColor: string,
): Promise<void> {
  const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewportEl || nodes.length === 0) throw new Error('Aucun contenu à exporter');
  const bounds = getNodesBounds(nodes);
  const width = Math.min(MAX_SIZE, Math.max(320, Math.ceil(bounds.width + PADDING * 2)));
  const height = Math.min(MAX_SIZE, Math.max(200, Math.ceil(bounds.height + PADDING * 2)));
  const viewport = getViewportForBounds(bounds, width, height, 0.1, 2, PADDING);
  const options = {
    backgroundColor,
    width,
    height,
    pixelRatio: 2,
    filter: (node: HTMLElement) => !(node.classList?.contains('presence-cursor') ?? false),
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  };
  const dataUrl = format === 'png' ? await toPng(viewportEl, options) : await toSvg(viewportEl, options);
  downloadDataUrl(`${filename}.${format}`, dataUrl);
}
