import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import type * as Y from 'yjs';
import { CloudOff, ShieldAlert } from 'lucide-react';
import { initDoc } from '@forkcast/doc';
import { useAuth } from '@/lib/auth';
import { useActor } from '@/lib/identity';
import { useSnapshot } from '@/docs/useSnapshot';
import { useSyncedDoc, type SyncedDocState } from '@/docs/useSyncedDoc';
import { Editor } from '@/components/editor/Editor';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/ui/spinner';

export function SyncedTreePage() {
  const { treeId = '' } = useParams();
  const state = useSyncedDoc(treeId);
  const { isLoggedIn } = useAuth();

  if (state.authError) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md space-y-4 py-10 text-center">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h1 className="text-xl font-semibold">Accès refusé</h1>
          <p className="text-sm text-muted-foreground">
            {isLoggedIn
              ? 'Vous n’êtes pas membre de cet arbre, ou votre invitation a expiré.'
              : 'Connectez-vous avec un compte membre de cet arbre pour l’ouvrir.'}
          </p>
          <div className="flex justify-center gap-2">
            {!isLoggedIn && (
              <Button asChild>
                <Link to={`/login?next=${encodeURIComponent(`/s/${treeId}`)}`}>Se connecter</Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/">Retour à mes arbres</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }
  if (!state.doc || !state.localSynced) return <LoadingScreen label="Ouverture de l’arbre…" />;
  return <SyncedEditor doc={state.doc} state={state} />;
}

function SyncedEditor({ doc, state }: { doc: Y.Doc; state: SyncedDocState }) {
  const tree = useSnapshot(doc);
  const actor = useActor();
  const empty = tree.meta.rootId === '';
  const readOnly = state.scope === 'readonly';
  const awareness = state.provider?.awareness ?? null;

  // Presence identity shared with the other participants.
  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField('user', {
      id: actor.actorId ?? String(awareness.clientID),
      name: actor.actorLabel ?? 'Anonyme',
      color: actor.color ?? '#4f46e5',
    });
  }, [awareness, actor]);

  // A brand new server document (no state yet) is initialized by the first editor.
  useEffect(() => {
    if (empty && state.serverSynced && state.scope === 'read-write') initDoc(doc, { title: 'Nouvel arbre' }, 'local');
  }, [empty, state.serverSynced, state.scope, doc]);

  if (empty) {
    if (state.status === 'disconnected') {
      return (
        <AppShell>
          <div className="mx-auto max-w-md space-y-3 py-10 text-center">
            <CloudOff className="mx-auto size-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Hors ligne</h1>
            <p className="text-sm text-muted-foreground">
              Cet arbre n’a jamais été chargé sur cet appareil : une connexion au serveur est nécessaire pour l’ouvrir la première fois.
            </p>
            <Button variant="outline" asChild>
              <Link to="/">Retour à mes arbres</Link>
            </Button>
          </div>
        </AppShell>
      );
    }
    return <LoadingScreen label="Synchronisation avec le serveur…" />;
  }

  return (
    <Editor
      key={doc.guid}
      doc={doc}
      treeKey={`synced:${state.treeId}`}
      treeId={state.treeId}
      readOnly={readOnly}
      sync={{ status: state.status, serverSynced: state.serverSynced, unsyncedChanges: state.unsyncedChanges, scope: state.scope }}
      awareness={awareness}
    />
  );
}
