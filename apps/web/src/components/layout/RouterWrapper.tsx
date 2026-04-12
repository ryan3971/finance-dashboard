import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/router';
import { useAuth } from '@/features/auth/useAuth';

/**
 * Bridges React auth state into the TanStack Router context on every render.
 *
 * TanStack Router's `beforeLoad` guards (e.g. `requireAuth`) read from the router
 * context, which is separate from React Context. Without this component, the router
 * would only see the auth snapshot from when it was first created — missing updates
 * after login or logout. Calling `router.update({ context: { auth } })` before
 * rendering keeps the two in sync.
 *
 * This sits between <AuthProvider> and <RouterProvider> in main.tsx.
 */
export function RouterWrapper() {
  const auth = useAuth();
  router.update({ context: { auth } });
  return <RouterProvider router={router} />;
}
