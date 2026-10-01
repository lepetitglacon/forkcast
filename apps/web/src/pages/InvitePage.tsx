import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MailOpen } from 'lucide-react';
import type { InvitationPreviewDto, Role } from '@forkcast/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { LoadingScreen, Spinner } from '@/components/ui/spinner';

const ROLE_LABELS: Record<Role, string> = { owner: 'propriétaire', editor: 'éditeur', viewer: 'lecteur' };

export function InvitePage() {
  const { token = '' } = useParams();
  const { isLoggedIn, isLoading } = useAuth();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const preview = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.get<InvitationPreviewDto>(`/api/invitations/${token}`),
    enabled: token.length > 0,
    retry: false,
  });

  if (isLoading) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} replace />;

  const accept = async () => {
    setAccepting(true);
    try {
      const res = await api.post<{ id?: string; treeId?: string }>(`/api/invitations/${token}/accept`);
      toast.success('Invitation acceptée');
      navigate(`/s/${res.treeId ?? res.id ?? preview.data?.treeId ?? ''}`, { replace: true });
    } catch (error) {
      toast.error('Impossible d’accepter l’invitation', { description: errorMessage(error) });
    } finally {
      setAccepting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        <MailOpen className="mx-auto size-10 text-primary" />
        {preview.isPending && <LoadingScreen label="Vérification de l’invitation…" />}
        {preview.isError && (
          <>
            <h1 className="text-xl font-semibold">Invitation invalide</h1>
            <p className="text-sm text-muted-foreground">{errorMessage(preview.error, 'Ce lien est expiré ou a déjà été utilisé.')}</p>
            <Button variant="outline" asChild>
              <Link to="/">Retour à mes arbres</Link>
            </Button>
          </>
        )}
        {preview.data && (
          <>
            <h1 className="text-xl font-semibold">Rejoindre « {preview.data.title} »</h1>
            <p className="text-sm text-muted-foreground">
              {preview.data.invitedBy} vous invite à rejoindre cet arbre en tant que {ROLE_LABELS[preview.data.role]}.
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => void accept()} disabled={accepting}>
                {accepting && <Spinner />} Accepter l’invitation
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Plus tard</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
