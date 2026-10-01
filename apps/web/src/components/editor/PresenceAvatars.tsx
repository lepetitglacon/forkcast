import type { PresenceState } from '@/docs/usePresence';
import { initials } from '@/lib/utils';
import { Hint } from '@/components/ui/tooltip';

export function PresenceAvatars({ presence }: { presence: PresenceState[] }) {
  if (presence.length === 0) return null;
  const shown = presence.slice(0, 6);
  return (
    <div className="flex items-center -space-x-1.5" aria-label={`${presence.length} participant(s) connecté(s)`}>
      {shown.map((p) => (
        <Hint key={p.clientId} label={p.user.name}>
          <span
            className="inline-flex size-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white"
            style={{ backgroundColor: p.user.color }}
          >
            {initials(p.user.name)}
          </span>
        </Hint>
      ))}
      {presence.length > shown.length && (
        <span className="inline-flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold">
          +{presence.length - shown.length}
        </span>
      )}
    </div>
  );
}
