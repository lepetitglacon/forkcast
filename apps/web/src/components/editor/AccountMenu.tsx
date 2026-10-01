import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogIn, LogOut, UserPlus, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn, initials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Round account button (initials, or a generic silhouette when signed out) with its menu. */
export function AccountMenu({ align = 'end', showName = false }: { align?: 'start' | 'end'; showName?: boolean }) {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('gap-2 px-1', showName && 'pr-2')} aria-label="Menu du compte">
          {isLoggedIn && user ? (
            <span
              className="inline-flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: user.color }}
            >
              {initials(user.name)}
            </span>
          ) : (
            <span className="inline-flex size-7 items-center justify-center rounded-full border border-dashed bg-muted text-muted-foreground">
              <UserRound className="size-4" />
            </span>
          )}
          {showName && (
            <span className="hidden max-w-32 truncate text-sm sm:inline">{isLoggedIn && user ? user.name : 'Se connecter'}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        {isLoggedIn && user ? (
          <>
            <DropdownMenuLabel className="truncate">
              <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
              <span className="block truncate">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/account')}>
              <UserRound /> Mon compte
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/account#mcp')}>
              <KeyRound /> Tokens MCP
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout}>
              <LogOut /> Déconnexion
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>Non connecté — vos arbres restent sur cet appareil</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(`/login?next=${next}`)}>
              <LogIn /> Se connecter
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/register?next=${next}`)}>
              <UserPlus /> Créer un compte
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
