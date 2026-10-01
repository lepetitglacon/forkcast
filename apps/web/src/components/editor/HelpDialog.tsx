import { useUiStore } from '@/store/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['Tab'], label: 'Ajouter un enfant au nœud sélectionné (et le renommer)' },
  { keys: ['Entrée'], label: 'Ajouter un frère (sauf pour la racine)' },
  { keys: ['F2'], label: 'Renommer le nœud (ou double-clic)' },
  { keys: ['Suppr', 'Retour'], label: 'Supprimer le nœud et sa branche' },
  { keys: ['Espace'], label: 'Replier / déplier la branche' },
  { keys: ['←'], label: 'Aller au parent' },
  { keys: ['→'], label: 'Aller au premier enfant' },
  { keys: ['↑', '↓'], label: 'Naviguer entre les frères' },
  { keys: ['Ctrl', 'Z'], label: 'Annuler' },
  { keys: ['Ctrl', 'Maj', 'Z'], label: 'Rétablir (ou Ctrl + Y)' },
  { keys: ['Échap'], label: 'Annuler le renommage / désélectionner' },
  { keys: ['?'], label: 'Afficher cette aide' },
];

export function HelpDialog() {
  const open = useUiStore((s) => s.helpOpen);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  return (
    <Dialog open={open} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Raccourcis clavier</DialogTitle>
          <DialogDescription>
            Sélectionnez un nœud puis utilisez le clavier comme dans une carte mentale. Le clic droit ouvre le menu contextuel ;
            glissez un nœud sur un autre pour le déplacer dans cette branche.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="contents">
              <dt className="flex items-center gap-1 whitespace-nowrap">
                {s.keys.map((k, i) => (
                  <span key={k} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground">+</span>}
                    <Kbd>{k}</Kbd>
                  </span>
                ))}
              </dt>
              <dd className="text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
