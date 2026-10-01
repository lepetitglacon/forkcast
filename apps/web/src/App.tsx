import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { createLocalTree } from '@/docs/localDocs';
import { useActor } from '@/lib/identity';
import { decodeShareHash } from '@/lib/share';
import { errorMessage } from '@/lib/errors';
import { useResolvedTheme } from '@/store/theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AccountPage } from '@/pages/AccountPage';
import { LoginPage, RegisterPage } from '@/pages/AuthPages';
import { HomePage } from '@/pages/HomePage';
import { InvitePage } from '@/pages/InvitePage';
import { LocalTreePage } from '@/pages/LocalTreePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OAuthConsentPage } from '@/pages/OAuthConsentPage';
import { SyncedTreePage } from '@/pages/SyncedTreePage';

/** Applies the resolved theme to <html> (class "dark"). */
function ThemeApplier() {
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return null;
}

/** `#share=<compressed json>` links create a new local tree and open it. */
function ShareImportGate() {
  const navigate = useNavigate();
  const actor = useActor();
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    if (!hash.startsWith('#share=')) return;
    const json = decodeShareHash(hash);
    // Drop the (huge) hash from the URL whatever happens next.
    navigate({ pathname, search, hash: '' }, { replace: true });
    if (json === null) {
      toast.error('Lien de partage illisible');
      return;
    }
    createLocalTree({ json, actor, summary: 'Arbre importé depuis un lien de partage' })
      .then((entry) => {
        toast.success(`« ${entry.title} » importé depuis le lien`);
        navigate(`/t/${entry.id}`, { replace: true });
      })
      .catch((error: unknown) => toast.error('Lien de partage invalide', { description: errorMessage(error) }));
  }, [navigate, pathname, search, hash, actor]);
  return null;
}

function AppToaster() {
  const theme = useResolvedTheme();
  return <Toaster theme={theme} position="bottom-right" richColors closeButton />;
}

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={400}>
        <ThemeApplier />
        <ShareImportGate />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/t/:id" element={<LocalTreePage />} />
          <Route path="/s/:treeId" element={<SyncedTreePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/oauth/consent" element={<OAuthConsentPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <AppToaster />
      </TooltipProvider>
    </BrowserRouter>
  );
}
