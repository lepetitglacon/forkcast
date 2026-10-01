import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';

export function NotFoundPage({ message = 'Cette page n’existe pas.' }: { message?: string }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        <SearchX className="mx-auto size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Introuvable</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button asChild>
          <Link to="/">Retour à mes arbres</Link>
        </Button>
      </div>
    </AppShell>
  );
}
