import { Code2, Coffee, Info, Keyboard, Settings } from 'lucide-react';
import { APP_VERSION, KOFI_URL, REPO_URL } from '@/lib/appInfo';
import { useUiStore } from '@/store/ui';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Hint } from '@/components/ui/tooltip';

export function GearMenu() {
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const setAboutOpen = useUiStore((s) => s.setAboutOpen);
  return (
    <DropdownMenu>
      <Hint label="Paramètres et aide">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Paramètres et aide">
            <Settings />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={() => setHelpOpen(true)}>
          <Keyboard /> Raccourcis clavier
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setAboutOpen(true)}>
          <Info /> À propos
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
            <Coffee /> Soutenir sur Ko-fi
          </a>
        </DropdownMenuItem>
        {REPO_URL && (
          <DropdownMenuItem asChild>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              <Code2 /> Code source
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal">Forkcast v{APP_VERSION}</DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
