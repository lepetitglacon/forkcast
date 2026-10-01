import { ViewportPortal, useViewport } from '@xyflow/react';
import { MousePointer2 } from 'lucide-react';
import type { PresenceState } from '@/docs/usePresence';

/** Cursors of the other participants, rendered in flow coordinates at constant screen size. */
export function PresenceLayer({ presence }: { presence: PresenceState[] }) {
  const { zoom } = useViewport();
  const withCursor = presence.filter((p) => p.cursor !== null);
  if (withCursor.length === 0) return null;
  return (
    <ViewportPortal>
      {withCursor.map((p) => (
        <div
          key={p.clientId}
          className="presence-cursor pointer-events-none absolute top-0 left-0 z-50"
          style={{
            transform: `translate(${p.cursor!.x}px, ${p.cursor!.y}px) scale(${1 / zoom})`,
            transformOrigin: 'top left',
          }}
        >
          <MousePointer2 className="size-4" style={{ color: p.user.color, fill: p.user.color }} />
          <span
            className="ml-3 inline-block rounded px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap text-white shadow"
            style={{ backgroundColor: p.user.color }}
          >
            {p.user.name}
          </span>
        </div>
      ))}
    </ViewportPortal>
  );
}
