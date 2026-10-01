import { Link } from 'react-router-dom';
import { GitFork, History, PanelRight } from 'lucide-react';
import { useDocContext } from '@/docs/DocContext';
import { usePresence } from '@/docs/usePresence';
import { useUiStore } from '@/store/ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DraftInput } from '@/components/ui/draft-input';
import { Hint } from '@/components/ui/tooltip';
import { AccountMenu } from './AccountMenu';
import { GearMenu } from './GearMenu';
import { PresenceAvatars } from './PresenceAvatars';
import { SharePopover } from './SharePopover';
import { LocalStatusChip, SyncStatusIndicator, type SyncInfo } from './SyncStatus';

/** Three columns (`1fr auto 1fr`): the centre group stays truly centred whatever the sides hold. */
export function EditorHeader({ sync }: { sync: SyncInfo | null }) {
  const { tree, treeId, readOnly, exec, awareness } = useDocContext();
  const presence = usePresence(awareness);
  const nodeDrawerOpen = useUiStore((s) => s.nodeDrawerOpen);
  const setNodeDrawerOpen = useUiStore((s) => s.setNodeDrawerOpen);
  const historyOpen = useUiStore((s) => s.historyOpen);
  const setHistoryOpen = useUiStore((s) => s.setHistoryOpen);

  return (
    <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b bg-background px-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <AccountMenu align="start" />
        <Hint label="Mes arbres">
          <Link
            to="/"
            aria-label="Accueil — mes arbres"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <GitFork className="size-4" />
          </Link>
        </Hint>
        <DraftInput
          value={tree.meta.title}
          disabled={readOnly}
          aria-label="Titre de l’arbre"
          className="h-8 min-w-0 max-w-72 flex-1 border-transparent bg-transparent font-semibold shadow-none hover:border-input focus-visible:border-ring"
          onCommit={(title) => {
            const t = title.trim();
            if (t && t !== tree.meta.title) exec({ type: 'setTitle', title: t });
          }}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <div className="hidden sm:block">{treeId ? sync && <SyncStatusIndicator sync={sync} /> : <LocalStatusChip />}</div>
        <SharePopover sync={sync} />
        <Hint label="Historique des modifications">
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(historyOpen && 'bg-accent text-primary')}
            aria-pressed={historyOpen}
            aria-label="Historique"
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            <History />
          </Button>
        </Hint>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1">
        <PresenceAvatars presence={presence} />
        <Hint label={nodeDrawerOpen ? 'Masquer le panneau du nœud' : 'Afficher le panneau du nœud'}>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(nodeDrawerOpen && 'bg-accent text-primary')}
            aria-pressed={nodeDrawerOpen}
            aria-label="Panneau du nœud"
            onClick={() => setNodeDrawerOpen(!nodeDrawerOpen)}
          >
            <PanelRight />
          </Button>
        </Hint>
        <GearMenu />
      </div>
    </header>
  );
}
