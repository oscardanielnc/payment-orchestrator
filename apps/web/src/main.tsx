import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { refreshSession } from './lib/api-client';
import { useSession } from './lib/session-store';
import './app/styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
});

// The access token lives in memory, so a reload starts signed out: the refresh cookie restores it.
void refreshSession().finally(() => useSession.getState().markReady());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
