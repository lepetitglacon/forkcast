import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GitFork } from 'lucide-react';
import { AccountMenu } from '@/components/editor/AccountMenu';
import { ThemeToggle } from '@/components/editor/ThemeControls';
import { cn } from '@/lib/utils';

export function AppShell({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-background">
        <div className={cn('mx-auto flex h-14 items-center gap-3 px-4', wide ? 'max-w-6xl' : 'max-w-3xl')}>
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GitFork className="size-4" />
            </span>
            Forkcast
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">arbres de décision ET / OU</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className={cn('mx-auto w-full flex-1 px-4 py-6', wide ? 'max-w-6xl' : 'max-w-3xl', className)}>{children}</main>
    </div>
  );
}
