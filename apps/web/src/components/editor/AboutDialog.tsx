import { useUiStore } from '@/store/ui';
import { APP_VERSION } from '@/lib/appInfo';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function AboutDialog() {
  const open = useUiStore((s) => s.aboutOpen);
  const setAboutOpen = useUiStore((s) => s.setAboutOpen);
  return (
    <Dialog open={open} onOpenChange={setAboutOpen}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>À propos</DialogTitle>
          <DialogDescription>Forkcast v{APP_VERSION}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            Avec l&apos;IA, comparer des outils n&apos;a jamais été aussi simple. Quel PSP choisir pour le paiement, quel hébergement,
            quelle solution d&apos;authentification : en quelques minutes, on obtient des comparatifs de prix, de limites et de risques.
          </p>
          <p>
            Le problème, c&apos;est la suite. Ces comparaisons restent dispersées dans des conversations, des notes et des onglets. Elles
            se croisent mal entre elles, et elles sont difficiles à présenter à son équipe. Or une feature ne se résume jamais à un seul
            choix : c&apos;est une combinaison de décisions, et ce qui compte, c&apos;est le coût de l&apos;ensemble.
          </p>
          <p>
            Forkcast donne un endroit à ce travail. On y décompose une feature en arbre : ce qui est indispensable d&apos;un côté, les
            alternatives possibles de l&apos;autre. On attribue des coûts, des délais ou des risques à chaque option, et Forkcast calcule
            le total de chaque combinaison pour les comparer d&apos;un coup d&apos;œil.
          </p>
          <p>L&apos;outil est pensé pour le travail d&apos;équipe :</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Collaboratif</strong> : on construit l&apos;arbre à plusieurs, en temps réel.
            </li>
            <li>
              <strong>Local-first</strong> : il fonctionne hors ligne et sans compte, et se synchronise quand on le souhaite.
            </li>
            <li>
              <strong>Exportable</strong> : JSON, PNG, SVG ou CSV, pour l&apos;intégrer à une présentation ou à une spécification.
            </li>
            <li>
              <strong>Connecté à votre IA</strong> : grâce à son serveur MCP, votre assistant peut construire et compléter l&apos;arbre
              directement, et ses estimations restent identifiées comme telles.
            </li>
          </ul>
          <p>
            Bref, tout ce qu&apos;il faut pour passer de l&apos;exploration à la décision, et créer de nouvelles features plus efficacement.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
