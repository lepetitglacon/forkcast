import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Download, FolderOpen, HardDrive, PencilLine, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { useActor } from '@/lib/identity';
import { downloadText, slugifyFilename } from '@/lib/utils';
import {
  deleteLocalTree,
  duplicateLocalTree,
  exportLocalTreeJson,
  publishTree,
  readLocalDocState,
  renameLocalTree,
} from '@/docs/localDocs';
import { useRegistry, type RegistryEntry } from '@/docs/registry';
import { Badge } from '@/components/ui/badge';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RenameDialog } from './RenameDialog';
import { TreeCard } from './TreeCard';

export function LocalTreesSection() {
  const entries = useRegistry();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const actor = useActor();
  const [renaming, setRenaming] = useState<RegistryEntry | null>(null);
  const [deleting, setDeleting] = useState<RegistryEntry | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const fail = (error: unknown, title: string) => toast.error(title, { description: errorMessage(error) });

  const duplicate = async (entry: RegistryEntry) => {
    try {
      const copy = await duplicateLocalTree(entry.id, actor);
      toast.success(`« ${copy.title} » créé`);
    } catch (error) {
      fail(error, 'Duplication impossible');
    }
  };

  const exportJson = async (entry: RegistryEntry) => {
    try {
      const json = await exportLocalTreeJson(entry.id);
      downloadText(`${slugifyFilename(json.title)}.json`, JSON.stringify(json, null, 2), 'application/json');
    } catch (error) {
      fail(error, 'Export impossible');
    }
  };

  const publish = async (entry: RegistryEntry) => {
    if (!isLoggedIn) {
      navigate(`/login?next=${encodeURIComponent('/')}`);
      return;
    }
    setPublishing(entry.id);
    try {
      const state = await readLocalDocState(entry.id);
      const created = await publishTree(entry.title, state);
      await deleteLocalTree(entry.id);
      toast.success('Arbre publié', { description: 'Il est désormais synchronisé et partageable.' });
      navigate(`/s/${created.id}`);
    } catch (error) {
      fail(error, 'Publication impossible');
    } finally {
      setPublishing(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="size-4 text-muted-foreground" />
        <h2 className="font-semibold">Sur cet appareil</h2>
        <span className="text-sm text-muted-foreground">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun arbre local. Créez-en un nouveau, partez de l’exemple ou importez un fichier JSON.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <TreeCard
              key={entry.id}
              to={`/t/${entry.id}`}
              title={entry.title}
              updatedAt={entry.updatedAt}
              badges={<Badge variant="muted">local</Badge>}
              menu={
                <>
                  <DropdownMenuItem onSelect={() => navigate(`/t/${entry.id}`)}>
                    <FolderOpen /> Ouvrir
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setRenaming(entry)}>
                    <PencilLine /> Renommer
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void duplicate(entry)}>
                    <Copy /> Dupliquer
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportJson(entry)}>
                    <Download /> Exporter en JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void publish(entry)} disabled={publishing === entry.id}>
                    <UploadCloud /> {isLoggedIn ? 'Publier (synchroniser)' : 'Publier — connexion requise'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setDeleting(entry)}>
                    <Trash2 /> Supprimer
                  </DropdownMenuItem>
                </>
              }
            />
          ))}
        </ul>
      )}

      <RenameDialog
        open={renaming !== null}
        initialTitle={renaming?.title ?? ''}
        onOpenChange={(open) => !open && setRenaming(null)}
        onSubmit={async (title) => {
          if (!renaming) return;
          try {
            await renameLocalTree(renaming.id, title, actor);
            setRenaming(null);
          } catch (error) {
            fail(error, 'Renommage impossible');
          }
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.title || 'Sans titre'} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              L’arbre sera définitivement effacé de cet appareil. Exportez-le en JSON si vous souhaitez le conserver.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteLocalTree(deleting.id);
                  toast.success('Arbre supprimé');
                } catch (error) {
                  fail(error, 'Suppression impossible');
                }
                setDeleting(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
