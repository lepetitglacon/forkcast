import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@xyflow/react/dist/style.css';
import './index.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable');

// StrictMode is intentionally not used: the editor owns non-idempotent resources
// (Y.Doc, IndexedDB persistence, websocket provider, undo manager).
createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
