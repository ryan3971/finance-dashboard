import * as Sentry from '@sentry/node';
import accountsMutationRouter from './features/accounts/accounts-mutation.routes';
import accountsRouter from './features/accounts/accounts.routes';
import anticipatedBudgetMutationRouter from './features/dashboards/anticipated-budget/anticipated-budget-mutation.routes';
import anticipatedBudgetRouter from './features/dashboards/anticipated-budget/anticipated-budget.routes';
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
import transfersRouter from '@/features/transfers/transfers.routes';
import userConfigRouter from './features/user-config/user-config.routes';

export function createApp() {
  const app = express();

  // ─── Core middleware ───────────────────────────────────────────────────────
  app.use(httpLogger);
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
  app.use('/api/v1/transfers', transfersRouter);
  app.use('/api/v1/tags', tagsRouter);
  app.use('/api/v1/user-config', userConfigRouter);
  app.use(
    '/api/v1/anticipated-budget',
    anticipatedBudgetRouter,
    anticipatedBudgetMutationRouter
  );

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
