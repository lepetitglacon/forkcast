import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-4 animate-spin', className)} aria-hidden />;
}

export function LoadingScreen({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner />
      {label}
    </div>
  );
}
