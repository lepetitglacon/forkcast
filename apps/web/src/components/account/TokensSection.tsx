import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Trash2, TriangleAlert } from 'lucide-react';
import type { McpScope, TokenCreatedDto, TokenDto } from '@forkcast/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CodeBlock, claudeCodeSnippet, claudeDesktopSnippet } from './McpSnippets';

const TOKENS_KEY = ['tokens'] as const;
const EXPIRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'never', label: 'Jamais' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
  { value: '365', label: '1 an' },
];

export function TokensSection() {
  const queryClient = useQueryClient();
  const tokens = useQuery({ queryKey: TOKENS_KEY, queryFn: () => api.get<TokenDto[]>('/api/tokens') });
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<McpScope[]>(['read', 'write']);
  const [expiry, setExpiry] = useState('never');
  const [created, setCreated] = useState<TokenCreatedDto | null>(null);
  const [revoking, setRevoking] = useState<TokenDto | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: TOKENS_KEY });
  const create = useMutation({
    mutationFn: (input: { name: string; scopes: McpScope[]; expiresInDays?: number }) => api.post<TokenCreatedDto>('/api/tokens', input),
    onSuccess: (token) => {
      invalidate();
      setCreated(token);
      setName('');
    },
    onError: (error) => toast.error('Création impossible', { description: errorMessage(error) }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tokens/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Jeton révoqué');
    },
    onError: (error) => toast.error('Révocation impossible', { description: errorMessage(error) }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || scopes.length === 0) return;
    create.mutate({
      name: name.trim(),
      scopes,
      ...(expiry === 'never' ? {} : { expiresInDays: Number(expiry) }),
    });
  };

  const toggleScope = (scope: McpScope, checked: boolean) =>
    setScopes((prev) => (checked ? [...new Set([...prev, scope])] : prev.filter((s) => s !== scope)));

  return (
    <section id="mcp" className="space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <h2 className="font-semibold">Jetons personnels MCP</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Un jeton permet à un assistant (Claude Code, Claude Desktop…) d’accéder à vos arbres via le serveur MCP. Le jeton n’est affiché qu’une seule fois à sa création.
      </p>

      {tokens.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Chargement…
        </div>
      )}
      {tokens.isError && <p className="text-sm text-destructive">{errorMessage(tokens.error)}</p>}
      {tokens.data && tokens.data.length === 0 && <p className="text-sm text-muted-foreground">Aucun jeton pour l’instant.</p>}
      {tokens.data && tokens.data.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {tokens.data.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{t.name}</span>
                  {t.scopes.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s === 'read' ? 'lecture' : 'écriture'}
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  Créé le {formatDate(t.createdAt)}
                  {t.lastUsedAt ? ` · utilisé le ${formatDateTime(t.lastUsedAt)}` : ' · jamais utilisé'}
                  {t.expiresAt ? ` · expire le ${formatDate(t.expiresAt)}` : ''}
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Révoquer" onClick={() => setRevoking(t)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="space-y-3 rounded-lg border border-dashed p-4">
        <div className="text-sm font-medium">Nouveau jeton</div>
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <div className="space-y-1.5">
            <Label htmlFor="token-name">Nom</Label>
            <Input id="token-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Claude Code sur mon portable" maxLength={100} required />
          </div>
          <div className="space-y-1.5">
            <Label>Expiration</Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger aria-label="Expiration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={scopes.includes('read')} onCheckedChange={(c) => toggleScope('read', c === true)} /> Lecture
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={scopes.includes('write')} onCheckedChange={(c) => toggleScope('write', c === true)} /> Écriture
          </label>
        </div>
        <Button type="submit" disabled={create.isPending || !name.trim() || scopes.length === 0}>
          {create.isPending ? <Spinner /> : <Plus />} Créer le jeton
        </Button>
      </form>

      <Dialog open={created !== null} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Jeton « {created?.name} » créé</DialogTitle>
            <DialogDescription className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-or" />
              Copiez ce jeton maintenant : il ne sera plus jamais affiché.
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-4">
              <CodeBlock label="Jeton" code={created.token} />
              <CodeBlock label="Claude Code (terminal)" code={claudeCodeSnippet(created.token)} />
              <CodeBlock label="Claude Desktop (claude_desktop_config.json)" code={claudeDesktopSnippet(created.token)} />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>J’ai copié le jeton</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer « {revoking?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>Les clients qui utilisent ce jeton perdront immédiatement l’accès.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => {
                if (revoking) revoke.mutate(revoking.id);
                setRevoking(null);
              }}
            >
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
