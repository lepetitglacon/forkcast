import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import type { OAuthConsentDto } from '@forkcast/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingScreen, Spinner } from '@/components/ui/spinner';

const SCOPE_LABELS: Record<string, string> = {
  read: 'Lire vos arbres',
  write: 'Modifier vos arbres',
};

export function OAuthConsentPage() {
  const [params] = useSearchParams();
  const requestId = params.get('request') ?? '';
  const { isLoggedIn, isLoading, user } = useAuth();
  const [deciding, setDeciding] = useState<boolean | null>(null);
  const consent = useQuery({
    queryKey: ['oauth-consent', requestId],
    queryFn: () => api.get<OAuthConsentDto>(`/api/oauth/consent/${requestId}`),
    enabled: isLoggedIn && requestId.length > 0,
    retry: false,
  });

  if (isLoading) return <LoadingScreen />;
  if (!isLoggedIn) {
    const back = `/oauth/consent?request=${encodeURIComponent(requestId)}`;
    return <Navigate to={`/login?next=${encodeURIComponent(back)}`} replace />;
  }

  const decide = async (approve: boolean) => {
    setDeciding(approve);
    try {
      const res = await api.post<{ redirectTo: string }>('/api/oauth/decision', { requestId, approve });
      window.location.assign(res.redirectTo);
    } catch (error) {
      toast.error('Décision impossible', { description: errorMessage(error) });
      setDeciding(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-md space-y-5 py-10">
        <ShieldCheck className="mx-auto size-10 text-primary" />
        {!requestId && <p className="text-center text-sm text-destructive">Requête d’autorisation manquante.</p>}
        {consent.isPending && requestId && <LoadingScreen label="Chargement de la demande…" />}
        {consent.isError && <p className="text-center text-sm text-destructive">{errorMessage(consent.error, 'Demande introuvable ou expirée')}</p>}
        {consent.data && (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-semibold">Autoriser « {consent.data.clientName} » ?</h1>
              <p className="text-sm text-muted-foreground">
                Cette application demande l’accès à votre compte Forkcast ({user?.email}) avec les droits suivants :
              </p>
            </div>
            <ul className="space-y-2 rounded-lg border p-4 text-sm">
              {consent.data.scopes.map((scope) => (
                <li key={scope} className="flex items-center gap-2">
                  <Badge variant="secondary">{scope}</Badge>
                  <span>{SCOPE_LABELS[scope] ?? scope}</span>
                </li>
              ))}
              {consent.data.scopes.length === 0 && <li className="text-muted-foreground">Aucun droit particulier.</li>}
            </ul>
            <p className="truncate text-center text-xs text-muted-foreground" title={consent.data.redirectUri}>
              Redirection vers {consent.data.redirectUri}
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => void decide(false)} disabled={deciding !== null}>
                {deciding === false && <Spinner />} Refuser
              </Button>
              <Button onClick={() => void decide(true)} disabled={deciding !== null}>
                {deciding === true && <Spinner />} Autoriser
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
