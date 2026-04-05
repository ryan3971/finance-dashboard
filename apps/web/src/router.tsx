import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { ImportPage } from '@/features/import/ImportPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
import type { AuthContextValue } from '@/features/auth/useAuth';

interface RouterContext {
  auth: AuthContextValue;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
});

const transactionsSearchSchema = z.object({
  accountId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  categoryId: z.string().optional(),
  flaggedOnly: z.boolean().optional(),
  page: z.number().int().positive().optional(),
});

function requireAuth({ context }: { context: RouterContext }) {
  if (!context.auth.isAuthenticated) {
    throw redirect({ to: '/login', replace: true });
  }
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: transactionsSearchSchema,
  beforeLoad: requireAuth,
  component: TransactionsPage,
});

const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounts',
  beforeLoad: requireAuth,
  component: AccountsPage,
});

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/import',
  beforeLoad: requireAuth,
  component: ImportPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  indexRoute,
  accountsRoute,
  importRoute,
]);

export const router = createRouter({
  routeTree,
  context: { auth: undefined! },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
