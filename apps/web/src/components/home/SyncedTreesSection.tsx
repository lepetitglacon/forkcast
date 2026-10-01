import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, FolderOpen, PencilLine, Trash2 } from 'lucide-react';
import type { Role, TreeMetaDto } from '@forkcast/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { deleteSyncedCache } from '@/docs/localDocs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
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

const ROLE_LABELS: Record<Role, string> = { owner: 'propriétaire', editor: 'éditeur', viewer: 'lecteur' };

export const TREES_QUERY_KEY = ['trees'] as const;

export function SyncedTreesSection() {
  const { isLoggedIn, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState<TreeMetaDto | null>(null);
  const [deleting, setDeleting] = useState<TreeMetaDto | null>(null);

  const trees = useQuery({
    queryKey: TREES_QUERY_KEY,
    queryFn: () => api.get<TreeMetaDto[]>('/api/trees'),
    enabled: isLoggedIn,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: TREES_QUERY_KEY });
  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.patch<TreeMetaDto>(`/api/trees/${id}`, { title }),
    onSuccess: () => {
      invalidate();
      setRenaming(null);
    },
    onError: (error) => toast.error('Renommage impossible', { description: errorMessage(error) }),
  });
  const remove = useMutation({
    mutationFn: async (tree: TreeMetaDto) => {
      await api.delete(`/api/trees/${tree.id}`);
      await deleteSyncedCache(tree.id).catch(() => undefined);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Arbre supprimé');
    },
    onError: (error) => toast.error('Suppression impossible', { description: errorMessage(error) }),
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Cloud className="size-4 text-muted-foreground" />
        <h2 className="font-semibold">Synchronisés</h2>
        {trees.data && <span className="text-sm text-muted-foreground">{trees.data.length}</span>}
      </div>
      {!isLoggedIn && !isLoading && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Connectez-vous
          </Link>{' '}
          pour synchroniser vos arbres, collaborer en temps réel et les confier à un assistant via MCP.
        </p>
      )}
      {(isLoading || (isLoggedIn && trees.isPending)) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Chargement…
        </div>
      )}
      {trees.isError && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
          <span className="flex-1">{errorMessage(trees.error, 'Impossible de charger les arbres synchronisés')}</span>
          <Button variant="outline" size="sm" onClick={() => void trees.refetch()}>
            Réessayer
          </Button>
        </div>
      )}
      {trees.data && trees.data.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun arbre synchronisé. Publiez un arbre local depuis son menu « ⋯ ».
        </p>
      )}
      {trees.data && trees.data.length > 0 && (
        <ul className="space-y-2">
          {trees.data.map((tree) => (
            <TreeCard
              key={tree.id}
              to={`/s/${tree.id}`}
              title={tree.title}
              updatedAt={tree.updatedAt}
              badges={
                <>
                  <Badge variant="secondary">synchronisé</Badge>
                  <Badge variant="outline">{ROLE_LABELS[tree.role]}</Badge>
                </>
              }
              menu={
                <>
                  <DropdownMenuItem onSelect={() => navigate(`/s/${tree.id}`)}>
                    <FolderOpen /> Ouvrir
                  </DropdownMenuItem>
                  {tree.role !== 'viewer' && (
                    <DropdownMenuItem onSelect={() => setRenaming(tree)}>
                      <PencilLine /> Renommer
                    </DropdownMenuItem>
                  )}
                  {tree.role === 'owner' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setDeleting(tree)}>
                        <Trash2 /> Supprimer
                      </DropdownMenuItem>
                    </>
                  )}
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
          if (renaming) await rename.mutateAsync({ id: renaming.id, title }).catch(() => undefined);
        }}
      />
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.title} » pour tous les membres ?</AlertDialogTitle>
            <AlertDialogDescription>L’arbre sera supprimé du serveur et ne sera plus accessible aux personnes invitées.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => {
                if (deleting) remove.mutate(deleting);
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
