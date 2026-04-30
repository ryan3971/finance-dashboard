import * as Sentry from '@sentry/node';
import accountsMutationRouter from './features/accounts/accounts-mutation.routes';
import accountsRouter from './features/accounts/accounts.routes';
import incomeDashboardRouter from './features/dashboards/income/income.routes';
import expensesDashboardRouter from './features/dashboards/expenses/expenses.routes';
import snapshotDashboardRouter from './features/dashboards/snapshot/snapshot.routes';
import ytdDashboardRouter from './features/dashboards/ytd/ytd.routes';
import anticipatedBudgetItemRouter from './features/anticipated-budget/anticipated-budget-item.routes';
import anticipatedBudgetRouter from './features/anticipated-budget/anticipated-budget.routes';
import authRouter from './features/auth/auth.routes';
import categoriesRouter from './features/categories/categories.routes';
import categorizationRulesRouter from './features/categorization-rules/categorization-rules.routes';
import { config } from './lib/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { errorHandler } from './middleware/error-handler';
import express from 'express';
import healthRouter from './routes/health.routes';
import { httpLogger } from './middleware/logger';
import importsRouter from './features/imports/imports.routes';
import tagsRouter from './features/tags/tags.routes';
import transactionsMutationRouter from './features/transactions/transactions-mutation.routes';
import transactionsRouter from './features/transactions/transactions.routes';
import rebalancingRouter from './features/rebalancing/rebalancing.routes';
import seedRouter from './features/seed/seed.routes';
import transfersRouter from '@/features/transfers/transfers.routes';
import userConfigRouter from './features/user-config/user-config.routes';

export function createApp() {
  const app = express();

  // ─── Core middleware ───────────────────────────────────────────────────────
  app.use(httpLogger);
  // Reflect the pino-http request ID back so clients can cite it in bug reports
  app.use((_req, res, next) => {
    const id = _req.id;
    const requestId = typeof id === 'string' || typeof id === 'number' ? String(id) : '';
    res.setHeader('x-request-id', requestId);
    next();
  });
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true, // Required for cookies
    })
  );

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/accounts', accountsRouter, accountsMutationRouter);
  app.use('/api/v1/imports', importsRouter);
  app.use(
    '/api/v1/transactions',
    transactionsRouter,
    transactionsMutationRouter
  );
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/categorization-rules', categorizationRulesRouter);
  app.use('/api/v1/rebalancing', rebalancingRouter);
  app.use('/api/v1/transfers', transfersRouter);
  app.use('/api/v1/tags', tagsRouter);
  app.use('/api/v1/user-config', userConfigRouter);
  app.use('/api/v1/seed', seedRouter);
  app.use(
    '/api/v1/anticipated-budget',
    anticipatedBudgetRouter,
    anticipatedBudgetItemRouter
  );
  app.use('/api/v1/dashboard', incomeDashboardRouter, expensesDashboardRouter, ytdDashboardRouter, snapshotDashboardRouter);

  // The error handler must be registered before any other error middleware and after all controllers
  Sentry.setupExpressErrorHandler(app);

  // 404 handler — must come after all routes
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler — must be last and have 4 parameters
  app.use(errorHandler);

  return app;
}
