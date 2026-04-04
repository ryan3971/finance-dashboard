import * as Sentry from '@sentry/node';

// NOTE: This file must be imported after config.ts (which loads dotenv) so
// that process.env.SENTRY_DSN is populated in development. In production,
// env vars are injected directly by the ECS task definition.
//
// Import order in server.ts: config → instrument → createApp

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  enableLogs: true,
});
