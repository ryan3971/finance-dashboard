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


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1, // Retry failed requests once
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
