import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CloudUpload, Copy, HardDrive, Link2, LogIn, Share2 } from 'lucide-react';
import { encodeDocState } from '@forkcast/doc';
import { toast } from 'sonner';
import { useDocContext } from '@/docs/DocContext';
import { deleteLocalTree, publishTree } from '@/docs/localDocs';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { encodeShareUrl } from '@/lib/share';
import { copyToClipboard } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { MembersPanel } from './MembersPanel';
import { SyncStatusIndicator, type SyncInfo } from './SyncStatus';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

async function copy(text: string, success: string, description?: string): Promise<void> {
  if (await copyToClipboard(text)) toast.success(success, description ? { description } : undefined);
  else toast.error('Impossible de copier le lien', { description: text });
}

function SnapshotLink() {
  const { tree } = useDocContext();
  return (
    <div className="space-y-1.5">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() =>
          void copy(encodeShareUrl(tree), 'Lien de partage copié', 'Le lien contient une copie de l’arbre : chaque destinataire obtient sa propre version.')
        }
      >
        <Link2 /> Copier le lien de partage
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Une copie figée de l’arbre est encodée dans le lien : pas besoin de compte pour l’ouvrir.
      </p>
    </div>
  );
}

function LocalShare() {
  const { doc, tree, localId } = useDocContext();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    setPublishing(true);
    try {
      const created = await publishTree(tree.meta.title, encodeDocState(doc));
      toast.success('Arbre publié', { description: 'Il est désormais synchronisé et partageable.' });
      navigate(`/s/${created.id}`);
      if (localId) void deleteLocalTree(localId);
    } catch (error) {
      toast.error('Publication impossible', { description: errorMessage(error) });
      setPublishing(false);
    }
  };

  return (
    <>
      <Section title="Partager une copie">
        <SnapshotLink />
      </Section>
      <Separator />
      <Section title="Synchroniser">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <HardDrive className="mt-0.5 size-3.5 shrink-0" />
          Cet arbre est enregistré sur cet appareil uniquement. Publiez-le pour le retrouver partout, le modifier à plusieurs en temps
          réel et le confier à un assistant via MCP.
        </p>
        {isLoggedIn ? (
          <Button size="sm" className="w-full" onClick={() => void publish()} disabled={publishing}>
            {publishing ? <Spinner /> : <CloudUpload />} Publier et synchroniser
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full"
            onClick={() => navigate(`/login?next=${encodeURIComponent(location.pathname)}`)}
          >
            <LogIn /> Se connecter pour synchroniser
          </Button>
        )}
      </Section>
    </>
  );
}

function SyncedShare({ treeId, sync }: { treeId: string; sync: SyncInfo | null }) {
  const url = `${window.location.origin}/s/${treeId}`;
  return (
    <>
      <Section title="Arbre synchronisé">
        {sync && <SyncStatusIndicator sync={sync} />}
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => void copy(url, 'Adresse de l’arbre copiée', 'Seuls les membres peuvent l’ouvrir.')}>
          <Copy /> Copier l’adresse de l’arbre
        </Button>
      </Section>
      <Separator />
      <MembersPanel treeId={treeId} />
      <Separator />
      <Section title="Partager une copie">
        <SnapshotLink />
      </Section>
    </>
  );
}

export function SharePopover({ sync }: { sync: SyncInfo | null }) {
  const { treeId } = useDocContext();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Share2 /> Partager
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="max-h-[min(36rem,calc(100dvh-5rem))] w-[26rem] max-w-[calc(100vw-1.5rem)] space-y-4 overflow-y-auto">
        {treeId ? <SyncedShare treeId={treeId} sync={sync} /> : <LocalShare />}
      </PopoverContent>
    </Popover>
  );
}
