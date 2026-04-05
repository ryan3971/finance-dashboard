import * as Sentry from '@sentry/react';
import { config } from '@/lib/config';

Sentry.init({
  dsn: config.sentryDsn,
  environment: config.env,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
