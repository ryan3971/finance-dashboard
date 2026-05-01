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

  // ── PII / financial-data scrubbing ───────────────────────────────────────
  // Sentry captures the full request context on errors. Without scrubbing,
  // that includes request bodies (transaction descriptions, amounts, account
  // names), cookies (refresh token), and user email — all sensitive for a
  // financial app and subject to PIPEDA/GDPR obligations.
  //
  // We keep enough signal for debugging (URL, method, headers minus auth) while
  // stripping everything that could identify a user or expose financial data.
  beforeSend(event) {
    if (event.request) {
      // Body may contain financial transaction data submitted by the user
      delete event.request.data;
      // Cookies carry the HttpOnly refresh token — never send to a third party
      delete event.request.cookies;
      // Strip the Authorization header (access token) if somehow captured
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
    }
    // Strip user PII — Sentry user context may be populated by future middleware
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  },
});
