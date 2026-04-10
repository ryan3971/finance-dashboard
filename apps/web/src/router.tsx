import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { AnticipatedBudgetPage } from '@/features/anticipated-budget/AnticipatedBudgetPage';
import { ExpensesPage } from '@/features/dashboards/expenses/ExpensesPage';
import { IncomePage } from '@/features/dashboards/income/IncomePage';
import { ConfigPage } from '@/features/config/ConfigPage';
import { ImportPage } from '@/features/import/ImportPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
import type { AuthContextValue } from '@/features/auth/useAuth';

interface RouterContext {
  auth: AuthContextValue | undefined;
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
  if (!context.auth?.isAuthenticated) {
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

const configRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config',
  beforeLoad: requireAuth,
  component: ConfigPage,
});

const anticipatedBudgetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/anticipated-budget',
  beforeLoad: requireAuth,
  component: AnticipatedBudgetPage,
});

const incomeDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard/income',
  beforeLoad: requireAuth,
  component: IncomePage,
});

const expenseDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard/expenses',
  beforeLoad: requireAuth,
  component: ExpensesPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  indexRoute,
  accountsRoute,
  importRoute,
  configRoute,
  anticipatedBudgetRoute,
  incomeDashboardRoute,
  expenseDashboardRoute,
]);

export const router = createRouter({
  routeTree,
  context: { auth: undefined },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
