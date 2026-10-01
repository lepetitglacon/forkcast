import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

function useNext(): string {
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  return next.startsWith('/') ? next : '/';
}

function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-sm space-y-6 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
        <p className="text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </AppShell>
  );
}

export function LoginPage() {
  const { login, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLoggedIn) navigate(next, { replace: true });
  }, [isLoggedIn, navigate, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Connexion impossible'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Connexion"
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to={`/register?next=${encodeURIComponent(next)}`} className="text-primary underline-offset-4 hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Spinner />} Se connecter
        </Button>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLoggedIn) navigate(next, { replace: true });
  }, [isLoggedIn, navigate, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Inscription impossible'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Créer un compte"
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to={`/login?next=${encodeURIComponent(next)}`} className="text-primary underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom affiché</Label>
          <Input id="name" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe (8 caractères minimum)</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Spinner />} Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  );
}
