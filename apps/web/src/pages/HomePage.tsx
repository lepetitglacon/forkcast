import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, FileUp, Sparkles } from 'lucide-react';
import { exampleTreeJson } from '@forkcast/doc';
import { toast } from 'sonner';
import { createLocalTree } from '@/docs/localDocs';
import { readRegistry } from '@/docs/registry';
import { errorMessage } from '@/lib/errors';
import { useActor } from '@/lib/identity';
import { pickFile } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { LocalTreesSection } from '@/components/home/LocalTreesSection';
import { SyncedTreesSection } from '@/components/home/SyncedTreesSection';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

const BOOTSTRAP_KEY = 'forkcast:bootstrapped';

export function HomePage() {
  const navigate = useNavigate();
  const actor = useActor();
  const [busy, setBusy] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  // Very first launch: create the example tree and open it.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let flag: string | null;
    try {
      flag = localStorage.getItem(BOOTSTRAP_KEY);
    } catch {
      return;
    }
    if (flag !== null || readRegistry().length > 0) return;
    try {
      localStorage.setItem(BOOTSTRAP_KEY, '1');
    } catch {
      return;
    }
    createLocalTree({ json: exampleTreeJson(), actor, summary: 'Arbre créé à partir de l’exemple' })
      .then((entry) => navigate(`/t/${entry.id}`))
      .catch((error: unknown) => toast.error('Création de l’exemple impossible', { description: errorMessage(error) }));
  }, [navigate, actor]);

  useEffect(() => {
    document.title = 'Forkcast — mes arbres';
  }, []);

  const create = async (kind: 'new' | 'example' | 'import') => {
    setBusy(kind);
    try {
      if (kind === 'new') {
        const entry = await createLocalTree({ title: 'Nouvel arbre', actor, summary: 'Arbre créé' });
        navigate(`/t/${entry.id}`);
      } else if (kind === 'example') {
        const entry = await createLocalTree({ json: exampleTreeJson(), actor, summary: 'Arbre créé à partir de l’exemple' });
        navigate(`/t/${entry.id}`);
      } else {
        const file = await pickFile('application/json,.json');
        if (!file) return;
        let json: unknown;
        try {
          json = JSON.parse(await file.text());
        } catch {
          toast.error('Fichier illisible', { description: 'Le fichier n’est pas un JSON valide.' });
          return;
        }
        const entry = await createLocalTree({ json, actor, summary: `Arbre importé depuis « ${file.name} »` });
        toast.success(`« ${entry.title} » importé`);
        navigate(`/t/${entry.id}`);
      }
    } catch (error) {
      toast.error('Impossible de créer l’arbre', { description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">Mes arbres</h1>
          <p className="text-sm text-muted-foreground">
            Explorez les options techniques d’une fonctionnalité : nœuds ET / OU, critères (coût, délai, risque…) et comparaison
            automatique de toutes les configurations. Tout fonctionne hors ligne ; un compte permet de collaborer.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void create('new')} disabled={busy !== null}>
              {busy === 'new' ? <Spinner /> : <FilePlus2 />} Nouvel arbre
            </Button>
            <Button variant="outline" onClick={() => void create('example')} disabled={busy !== null}>
              {busy === 'example' ? <Spinner /> : <Sparkles />} Arbre d’exemple
            </Button>
            <Button variant="outline" onClick={() => void create('import')} disabled={busy !== null}>
              {busy === 'import' ? <Spinner /> : <FileUp />} Importer un JSON
            </Button>
          </div>
        </div>
        <LocalTreesSection />
        <SyncedTreesSection />
      </div>
    </AppShell>
  );
}
