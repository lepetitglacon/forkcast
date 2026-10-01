import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { McpSnippets } from '@/components/account/McpSnippets';
import { TokensSection } from '@/components/account/TokensSection';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/ui/spinner';

export function AccountPage() {
  const { user, isLoading, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Forkcast — mon compte';
  }, []);

  if (isLoading) return <LoadingScreen />;
  if (!isLoggedIn || !user) return <Navigate to="/login?next=%2Faccount" replace />;

  return (
    <AppShell>
      <div className="space-y-10">
        <section className="flex items-center gap-4">
          <span
            className="inline-flex size-14 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: user.color }}
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{user.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            <LogOut /> Déconnexion
          </Button>
        </section>
        <TokensSection />
        <section className="space-y-3">
          <h2 className="font-semibold">Configurer un assistant</h2>
          <McpSnippets token={null} />
        </section>
      </div>
    </AppShell>
  );
}
