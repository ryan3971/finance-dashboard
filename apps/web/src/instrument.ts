import * as Sentry from '@sentry/react';
import { config } from '@/lib/config';

const isProd = config.env === 'production';
const isStaging = config.env === 'staging';

let replaysSessionSampleRate = 0;
if (isProd) replaysSessionSampleRate = 0.1;
else if (isStaging) replaysSessionSampleRate = 1.0;

Sentry.init({
  dsn: config.sentryDsn,
  environment: config.env,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate,
  replaysOnErrorSampleRate: isProd || isStaging ? 1.0 : 0,
});
