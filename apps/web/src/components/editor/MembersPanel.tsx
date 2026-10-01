import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Link2, Trash2 } from 'lucide-react';
import type { InvitationDto, MemberDto, Role } from '@forkcast/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { copyToClipboard } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

const ROLE_LABELS: Record<Role, string> = { owner: 'Propriétaire', editor: 'Éditeur', viewer: 'Lecteur' };

/** Invitation link creation + members list with roles, for a synced tree. */
export function MembersPanel({ treeId }: { treeId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const membersKey = ['trees', treeId, 'members'] as const;

  const members = useQuery({ queryKey: membersKey, queryFn: () => api.get<MemberDto[]>(`/api/trees/${treeId}/members`) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: membersKey });
  const onError = (error: unknown) => toast.error('Action impossible', { description: errorMessage(error) });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'editor' | 'viewer' }) =>
      api.patch(`/api/trees/${treeId}/members/${userId}`, { role }),
    onSuccess: invalidate,
    onError,
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api.delete(`/api/trees/${treeId}/members/${userId}`),
    onSuccess: () => {
      void invalidate();
      toast.success('Membre retiré');
    },
    onError,
  });
  const createInvitation = useMutation({
    mutationFn: (role: 'editor' | 'viewer') => api.post<InvitationDto>(`/api/trees/${treeId}/invitations`, { role }),
    onSuccess: async (inv) => {
      const link = `${window.location.origin}/invite/${inv.token}`;
      setInviteLink(link);
      const ok = await copyToClipboard(link);
      setCopied(ok);
      toast.success(ok ? 'Lien d’invitation copié' : 'Lien d’invitation créé');
    },
    onError,
  });

  const me = user?.id;
  const myRole = members.data?.find((m) => m.userId === me)?.role;
  const canManage = myRole === 'owner';

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">Inviter par lien</h3>
        <div className="flex items-center gap-2">
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'editor' | 'viewer')}>
            <SelectTrigger size="sm" className="w-32" aria-label="Rôle de l’invitation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Éditeur</SelectItem>
              <SelectItem value="viewer">Lecteur</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => createInvitation.mutate(inviteRole)} disabled={createInvitation.isPending}>
            {createInvitation.isPending ? <Spinner /> : <Link2 />} Créer un lien d’invitation
          </Button>
        </div>
        {inviteLink && (
          <div className="flex items-center gap-2">
            <Input readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} className="h-8 font-mono text-xs" />
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Copier le lien"
              onClick={async () => {
                setCopied(await copyToClipboard(inviteLink));
              }}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Toute personne disposant du lien et d’un compte pourra rejoindre l’arbre avec ce rôle.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">Membres</h3>
        {members.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Chargement…
          </div>
        )}
        {members.isError && <p className="text-sm text-destructive">{errorMessage(members.error)}</p>}
        {members.data && (
          <ul className="divide-y rounded-lg border">
            {members.data.map((m) => (
              <li key={m.userId} className="flex items-center gap-2 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {m.name} {m.userId === me && <span className="text-xs text-muted-foreground">(vous)</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                </div>
                {m.role === 'owner' || !canManage || m.userId === me ? (
                  <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>{ROLE_LABELS[m.role]}</Badge>
                ) : (
                  <>
                    <Select
                      value={m.role}
                      onValueChange={(role) => changeRole.mutate({ userId: m.userId, role: role as 'editor' | 'viewer' })}
                    >
                      <SelectTrigger size="sm" className="w-28" aria-label="Rôle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Éditeur</SelectItem>
                        <SelectItem value="viewer">Lecteur</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      aria-label="Retirer"
                      onClick={() => removeMember.mutate(m.userId)}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
