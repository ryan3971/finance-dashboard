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
import helmet from 'helmet';
import healthRouter from './routes/health.routes';
import { httpLogger } from './middleware/logger';
import importsRouter from './features/imports/imports.routes';
import rateLimit from 'express-rate-limit';
import tagsRouter from './features/tags/tags.routes';
import transactionsMutationRouter from './features/transactions/transactions-mutation.routes';
import transactionsRouter from './features/transactions/transactions.routes';
import rebalancingRouter from './features/rebalancing/rebalancing.routes';
import transfersRouter from '@/features/transfers/transfers.routes';
import userConfigRouter from './features/user-config/user-config.routes';

export function createApp() {
  const app = express();

  // ─── Security headers ─────────────────────────────────────────────────────
  // Helmet sets safe response-header defaults on every reply:
  //   • Strict-Transport-Security   — browsers will only connect over HTTPS
  //   • X-Content-Type-Options      — prevents MIME-type sniffing
  //   • X-Frame-Options             — blocks clickjacking via iframe embeds
  //   • Content-Security-Policy     — restrictive default policy
  //   • Referrer-Policy             — limits referrer leakage
  //   • X-DNS-Prefetch-Control      — disables speculative DNS lookups
  // Registered first so every response — including 4xx/5xx — carries these headers.
  app.use(helmet());

  // ─── Rate limiting ────────────────────────────────────────────────────────
  // authLimiter: tight cap on credential endpoints to deter brute-forcing.
  // apiLimiter:  generous cap on all other routes to block abusive clients
  //              while leaving normal usage unaffected.
  // Both are no-ops in the test environment so integration tests are unaffected.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute sliding window
    limit: 15,                  // max 15 auth attempts per window per IP
    standardHeaders: 'draft-8', // RateLimit-* headers per IETF draft
    legacyHeaders: false,       // suppress deprecated X-RateLimit-* headers
    skip: () => config.nodeEnv === 'test',
    message: { error: 'Too many requests, please try again later' },
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute sliding window
    limit: 300,                 // max 300 requests per window per IP
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test',
    message: { error: 'Too many requests, please try again later' },
  });

  // Apply the general API limiter to all /api/v1 routes up-front.
  // Auth routes additionally pass through authLimiter below.
  app.use('/api/v1', apiLimiter);

  // ─── Core middleware ───────────────────────────────────────────────────────
  app.use(httpLogger);
  // Reflect the pino-http request ID back so clients can cite it in bug reports
  app.use((_req, res, next) => {
    const id = _req.id;
    const requestId = typeof id === 'string' || typeof id === 'number' ? String(id) : '';
    res.setHeader('x-request-id', requestId);
    next();
  });
  // 1 MB cap prevents a single oversized payload from exhausting container memory
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true, // Required for cookies
    })
  );

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/v1', healthRouter);
  // Auth routes are subject to both the general API limit and the tighter auth limit
  app.use('/api/v1/auth', authLimiter, authRouter);
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
