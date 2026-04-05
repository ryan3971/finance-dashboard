import './instrument';
import './index.css';
import * as Sentry from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from '@/router';
import { useAuth } from '@/features/auth/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function RouterWrapper() {
  const auth = useAuth();
  // Keep router context in sync with React auth state so beforeLoad guards
  // receive fresh auth on every render (including after login/logout).
  router.update({ context: { auth } });
  return <RouterProvider router={router} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Sentry.ErrorBoundary fallback={<p>An unexpected error occurred.</p>}>
          <RouterWrapper />
        </Sentry.ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
