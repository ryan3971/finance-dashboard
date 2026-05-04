import './instrument';
import './index.css';
import * as Sentry from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { RouterWrapper } from '@/components/layout/RouterWrapper';
import { Toaster } from '@/components/ui/Sonner';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// TODO; failing in network offline immediately may not be the best approach. We should consider showing an offline banner and retrying failed requests when the network is back online, rather than immediately giving up on mutations that fail due to network issues.
// TODO: Also, can expand the errors reproted to the user to provide more detailed feedback on what went wrong and how to fix it, rather than just a generic "An unexpected error occurred" message. For example, we could show specific messages for network errors, validation errors, etc., and provide actionable steps for the user to resolve the issue (e.g. "Please check your internet connection and try again" for network errors).

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
    },
    mutations: {
      networkMode: 'always',
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Sentry.ErrorBoundary fallback={<p>An unexpected error occurred.</p>}>
          <TooltipProvider>
            <ErrorBoundary>
              <RouterWrapper />
            </ErrorBoundary>
            <Toaster />
          </TooltipProvider>
        </Sentry.ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
