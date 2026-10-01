import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Ellipsis } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface TreeCardProps {
  to: string;
  title: string;
  updatedAt: number | string;
  badges?: ReactNode;
  menu?: ReactNode;
}

export function TreeCard({ to, title, updatedAt, badges, menu }: TreeCardProps) {
  return (
    <li className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/50">
      <Link to={to} className="min-w-0 flex-1">
        <div className="truncate font-medium">{title || 'Sans titre'}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Modifié le {formatDateTime(updatedAt)}</span>
          {badges}
        </div>
      </Link>
      {menu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Actions">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {menu}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
