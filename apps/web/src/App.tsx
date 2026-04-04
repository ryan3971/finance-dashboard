import * as Sentry from '@sentry/react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthProvider';
import { ImportPage } from './features/import/ImportPage';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { RegisterPage } from './features/auth/RegisterPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p>An unexpected error occurred.</p>}>
      <AuthProvider>
        <SentryRoutes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <TransactionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/import"
            element={
              <ProtectedRoute>
                <ImportPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </SentryRoutes>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}
