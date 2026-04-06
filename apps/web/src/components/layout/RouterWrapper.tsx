import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/router';
import { useAuth } from '@/features/auth/useAuth';

export function RouterWrapper() {
  const auth = useAuth();
  // Keep router context in sync with React auth state so beforeLoad guards
  // receive fresh auth on every render (including after login/logout).
  router.update({ context: { auth } });
  return <RouterProvider router={router} />;
}
