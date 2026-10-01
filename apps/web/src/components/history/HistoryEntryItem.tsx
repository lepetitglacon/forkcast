import { memo } from 'react';
import { Import, RotateCcw, Sparkles } from 'lucide-react';
import type { ActivityEntry } from '@forkcast/shared';
import { canRevertActivity } from '@forkcast/doc';
import { assistantDetail, authorInitials, authorLabel, formatRelativeTime } from '@/lib/history';
import { formatDateTime } from '@/lib/format';
import { cn, presenceColorFor } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface HistoryEntryItemProps {
  entry: ActivityEntry;
  now: number;
  readOnly: boolean;
  active?: boolean;
  onSelect: (entry: ActivityEntry) => void;
  onRevert: (entry: ActivityEntry) => void;
}

function Avatar({ entry }: { entry: ActivityEntry }) {
  if (entry.actor === 'ai') {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ai text-white shadow-sm" aria-hidden>
        <Sparkles className="size-3.5" />
      </span>
    );
  }
  if (entry.actor === 'import') {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
        <Import className="size-3.5" />
      </span>
    );
  }
  const color = entry.color ?? presenceColorFor(entry.actorId ?? entry.actorLabel ?? 'x');
  return (
    <span
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-sm"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {authorInitials(entry)}
    </span>
  );
}

function HistoryEntryItemInner({ entry, now, readOnly, active, onSelect, onRevert }: HistoryEntryItemProps) {
  const ai = entry.actor === 'ai';
  const detail = assistantDetail(entry);
  const revertable = !readOnly && canRevertActivity(entry);
  return (
    <li
      className={cn(
        'group relative flex gap-2.5 rounded-lg border border-transparent px-2 py-2 transition-colors hover:bg-accent/60',
        ai && 'border-l-2 border-l-ai bg-ai/5',
        active && 'border-primary/40 bg-primary/10',
        entry.reverted && 'opacity-60',
      )}
    >
      <Avatar entry={entry} />
      <button
        type="button"
        className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        onClick={() => onSelect(entry)}
        title="Afficher dans l’arbre"
      >
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className={cn('truncate font-semibold', ai && 'text-ai')}>{authorLabel(entry)}</span>
          {detail && <span className="truncate text-muted-foreground">· {detail}</span>}
          <time className="ml-auto shrink-0 text-[11px] text-muted-foreground" dateTime={new Date(entry.at).toISOString()} title={formatDateTime(entry.at)}>
            {formatRelativeTime(entry.at, now)}
          </time>
        </div>
        <p className={cn('mt-0.5 text-sm leading-snug break-words', entry.reverted && 'line-through')}>{entry.summary}</p>
        {entry.reverted && <span className="text-[11px] text-muted-foreground">Annulée</span>}
      </button>
      {revertable && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 self-center px-2 text-xs"
          onClick={() => onRevert(entry)}
          aria-label={`Annuler : ${entry.summary}`}
        >
          <RotateCcw /> Annuler
        </Button>
      )}
    </li>
  );
}

export const HistoryEntryItem = memo(HistoryEntryItemInner);
