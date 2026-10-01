import type { ReactNode } from 'react';
import { Cloud, CloudOff, Eye, HardDrive, LoaderCircle } from 'lucide-react';
import type { AuthorizedScope } from '@hocuspocus/provider';
import type { SyncStatus as Status } from '@/docs/useSyncedDoc';
import { cn } from '@/lib/utils';
import { Hint } from '@/components/ui/tooltip';

export interface SyncInfo {
  status: Status;
  serverSynced: boolean;
  unsyncedChanges: number;
  scope: AuthorizedScope | null;
}

export function SyncStatusIndicator({ sync }: { sync: SyncInfo }) {
  let icon: ReactNode;
  let label: string;
  let tone: string;
  if (sync.status === 'connected' && sync.serverSynced) {
    if (sync.unsyncedChanges > 0) {
      icon = <LoaderCircle className="size-3.5 animate-spin" />;
      label = `Synchronisation… (${sync.unsyncedChanges})`;
      tone = 'text-or';
    } else {
      icon = <Cloud className="size-3.5" />;
      label = 'Connecté';
      tone = 'text-green-600 dark:text-green-400';
    }
  } else if (sync.status === 'connecting' || (sync.status === 'connected' && !sync.serverSynced)) {
    icon = <LoaderCircle className="size-3.5 animate-spin" />;
    label = 'Connexion…';
    tone = 'text-muted-foreground';
  } else {
    icon = <CloudOff className="size-3.5" />;
    label = sync.unsyncedChanges > 0 ? `Hors ligne · ${sync.unsyncedChanges} modif. en attente` : 'Hors ligne';
    tone = 'text-or';
  }
  return (
    <div className="flex items-center gap-2">
      <Hint
        label={
          sync.status === 'disconnected'
            ? 'Les modifications sont conservées localement et seront envoyées à la reconnexion.'
            : 'Les modifications sont partagées en temps réel.'
        }
      >
        <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs whitespace-nowrap', tone)}>
          {icon}
          {label}
        </span>
      </Hint>
      {sync.scope === 'readonly' && (
        <Hint label="Vous pouvez consulter cet arbre mais pas le modifier.">
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
            <Eye className="size-3.5" /> Lecture seule
          </span>
        </Hint>
      )}
    </div>
  );
}

export function LocalStatusChip() {
  return (
    <Hint label="Enregistré sur cet appareil uniquement. Partager › Publier pour le synchroniser.">
      <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground">
        <HardDrive className="size-3.5" /> Sur cet appareil
      </span>
    </Hint>
  );
}
