import { useParams } from 'react-router-dom';
import { useLocalDoc } from '@/docs/useLocalDoc';
import { useRegistry } from '@/docs/registry';
import { Editor } from '@/components/editor/Editor';
import { LoadingScreen } from '@/components/ui/spinner';
import { NotFoundPage } from './NotFoundPage';

export function LocalTreePage() {
  const { id = '' } = useParams();
  const registry = useRegistry();
  const known = registry.some((e) => e.id === id);
  const { doc, ready } = useLocalDoc(known ? id : '');

  if (!known) return <NotFoundPage message="Cet arbre n’existe pas sur cet appareil." />;
  if (!ready || !doc) return <LoadingScreen label="Ouverture de l’arbre…" />;
  return <Editor key={doc.guid} doc={doc} treeKey={`local:${id}`} localId={id} readOnly={false} />;
}
