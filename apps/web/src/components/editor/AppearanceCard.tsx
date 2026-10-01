import type { ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, LayoutGrid, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { useDocContext } from '@/docs/DocContext';
import { ORIENTATION_LABELS, type Orientation } from '@/lib/orientation';
import { EMPTY_POSITIONS, useUiStore, type ThemeMode } from '@/store/ui';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { Hint } from '@/components/ui/tooltip';

const ORIENTATION_OPTIONS: SegmentedOption<Orientation>[] = [
  { value: 'lr', label: <ArrowRight />, title: ORIENTATION_LABELS.lr },
  { value: 'rl', label: <ArrowLeft />, title: ORIENTATION_LABELS.rl },
  { value: 'tb', label: <ArrowDown />, title: ORIENTATION_LABELS.tb },
  { value: 'bt', label: <ArrowUp />, title: ORIENTATION_LABELS.bt },
];

const THEME_OPTIONS: SegmentedOption<ThemeMode>[] = [
  { value: 'light', label: <><Sun className="size-3.5" /> Clair</> },
  { value: 'dark', label: <><Moon className="size-3.5" /> Sombre</> },
  { value: 'system', label: <><Monitor className="size-3.5" /> Système</> },
];

function Row({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        {hint && <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function AppearanceCard() {
  const { treeKey } = useDocContext();
  const collapsed = useUiStore((s) => s.appearanceCollapsed);
  const setCollapsed = useUiStore((s) => s.setAppearanceCollapsed);
  const sketch = useUiStore((s) => s.sketch);
  const setSketch = useUiStore((s) => s.setSketch);
  const freeMove = useUiStore((s) => s.freeMove);
  const setFreeMove = useUiStore((s) => s.setFreeMove);
  const snapToGrid = useUiStore((s) => s.snapToGrid);
  const setSnapToGrid = useUiStore((s) => s.setSnapToGrid);
  const orientation = useUiStore((s) => s.orientation);
  const setOrientation = useUiStore((s) => s.setOrientation);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const positions = useUiStore((s) => s.positions[treeKey]) ?? EMPTY_POSITIONS;
  const clearPositions = useUiStore((s) => s.clearPositions);
  const placedCount = Object.keys(positions).length;

  if (collapsed) {
    return (
      <Hint label="Apparence" side="right">
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-lg bg-card shadow-md"
          onClick={() => setCollapsed(false)}
          aria-label="Afficher les options d’apparence"
        >
          <Palette />
        </Button>
      </Hint>
    );
  }

  return (
    <section
      aria-label="Apparence"
      className="w-64 space-y-3 rounded-xl border bg-card/95 p-3 text-card-foreground shadow-lg backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Palette className="size-4 text-muted-foreground" /> Apparence
        </h2>
        <Hint label="Replier">
          <Button variant="ghost" size="icon-xs" onClick={() => setCollapsed(true)} aria-label="Replier les options d’apparence">
            <ChevronDown />
          </Button>
        </Hint>
      </div>

      <Row id="appearance-sketch" label="Style cartoon" hint="Traits dessinés à la main">
        <Switch id="appearance-sketch" checked={sketch} onCheckedChange={setSketch} />
      </Row>
      <Row id="appearance-free" label="Déplacement libre" hint={freeMove ? 'Les cartes restent où vous les déposez' : 'Disposition automatique'}>
        <Switch id="appearance-free" checked={freeMove} onCheckedChange={setFreeMove} />
      </Row>
      {freeMove && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={placedCount === 0}
          onClick={() => clearPositions(treeKey)}
        >
          <LayoutGrid /> Réorganiser{placedCount > 0 ? ` (${placedCount} carte${placedCount > 1 ? 's' : ''} placée${placedCount > 1 ? 's' : ''})` : ''}
        </Button>
      )}
      <Row id="appearance-grid" label="Grille magnétique" hint="Grille de points, aimantation 16 px">
        <Switch id="appearance-grid" checked={snapToGrid} onCheckedChange={setSnapToGrid} />
      </Row>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">Orientation</span>
        <Segmented ariaLabel="Orientation de l’arbre" value={orientation} options={ORIENTATION_OPTIONS} onChange={setOrientation} />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm">Thème</span>
        <Segmented ariaLabel="Thème" value={theme} options={THEME_OPTIONS} onChange={setTheme} className="flex w-full" />
      </div>
    </section>
  );
}
