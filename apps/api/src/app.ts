import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { httpLogger } from './middleware/logger';
import { errorHandler } from './middleware/error';
import healthRouter from './routes/health.routes';
import authRouter from './routes/auth.routes';
import accountsRouter from './routes/accounts.routes';
import importsRouter from './routes/imports.routes';
import transactionsRouter from './routes/transactions.routes';

export function createApp() {
  const app = express();

  // ─── Core middleware ───────────────────────────────────────────────────────
  app.use(httpLogger);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      credentials: true, // Required for cookies
    })
  );

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/accounts', accountsRouter);
  app.use('/api/v1/imports', importsRouter);
  app.use('/api/v1/transactions', transactionsRouter);

  // 404 handler — must come after all routes
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler — must be last and have 4 parameters
  app.use(errorHandler);

  return app;
}
