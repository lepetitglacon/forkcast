import { subtreeIds } from '@forkcast/doc';
import { useDocContext } from '@/docs/DocContext';
import { useNodeActions } from '@/docs/useNodeActions';
import { useUiStore } from '@/store/ui';
import { plural } from '@/lib/format';
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

export function DeleteConfirmDialog() {
  const { tree } = useDocContext();
  const actions = useNodeActions();
  const pendingId = useUiStore((s) => s.pendingDeleteId);
  const setPendingDelete = useUiStore((s) => s.setPendingDelete);
  const node = pendingId ? tree.nodes[pendingId] : undefined;
  const count = pendingId && node ? subtreeIds(tree, pendingId).length - 1 : 0;

  return (
    <AlertDialog open={node !== undefined} onOpenChange={(open) => !open && setPendingDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {node?.label || 'sans titre'} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette branche contient {plural(count, 'nœud enfant', 'nœuds enfants')} qui seront supprimés avec elle. L’opération reste
            annulable avec Ctrl + Z.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction destructive onClick={() => pendingId && actions.deleteNow(pendingId)}>
            Supprimer {count + 1} nœuds
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
