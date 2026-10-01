import { Moon, Sun } from 'lucide-react';
import { useResolvedTheme } from '@/store/theme';
import { useUiStore } from '@/store/ui';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';

export function ThemeToggle() {
  const resolved = useResolvedTheme();
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <Hint label={resolved === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
        aria-label={resolved === 'dark' ? 'Thème clair' : 'Thème sombre'}
      >
        {resolved === 'dark' ? <Sun /> : <Moon />}
      </Button>
    </Hint>
  );
}
