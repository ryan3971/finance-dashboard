# API — CLAUDE.md

Guidance specific to `apps/api`.

## Structure (`src/`)

Feature-based modules under `features/`. Each feature owns its routes, service, and tests:
```
features/auth/
  auth.routes.ts      # Express router
  auth.service.ts     # DB queries and business logic
  auth.errors.ts      # Domain error codes, messages, HTTP status mapping
  auth.routes.test.ts
```

Other top-level directories:
- `db/` — Drizzle schema, migrations, seeds
- `middleware/` — Error handler, logger, auth (`requireAuth`)
- `lib/` — Config loader, JWT helpers
- `pipelines/` — Cross-feature logic (transfer detection)
- `testing/` — Vitest setup and shared test helpers

Entry: `server.ts` loads config first, then starts the app defined in `app.ts`.

Config is loaded once at startup via `src/lib/config.ts` — the single source of truth for all env vars in the API.

## Auth flow

- Access token: short-lived JWT, sent as `Authorization: Bearer` header
- Refresh token: longer-lived JWT, stored in HttpOnly cookie (path `/api/v1/auth`)
- `requireAuth` middleware validates the Bearer token and attaches `req.user` (`{ id, email }`)
- Refresh tokens are rotated on each use

## Database

PostgreSQL 15 via Docker (`docker-compose.yml`). Drizzle ORM with generated migrations.

- Dev DB: `finance_dev`, Test DB: `finance_test` — both on port `5434`
- Schema: `src/db/schema.ts`
- Tests switch to `DATABASE_URL_TEST` automatically via `testing/setup.ts`
- Tests run serially (`fileParallelism: false`) to avoid DB race conditions

## AI categorization

Pluggable provider (Anthropic or OpenAI) configured via `AI_PROVIDER` env var. Disabled by default (`ENABLE_AI_CATEGORIZATION=false`) to avoid API costs in development.

## Code conventions

- Service functions return data or `null` — the route layer translates `null` to 404. Services do not throw for not-found cases.
- Express v5 is in use. Async route handlers do **not** need try/catch — Express v5 automatically forwards rejected promises to error-handling middleware.
- Zod validation happens at the route layer before calling services.
- `req.user` is typed as optional by Express but is always present after `requireAuth`. Use `getAuthUser(req)` (from `@/lib/auth`) instead of `req.user!` — it throws a descriptive error if called outside a guarded route, catching misuse at runtime rather than silently returning `undefined`.

## Error handling

Services never use HTTP status codes. Business rule violations are thrown as domain errors — see `src/lib/domain-error.ts` for the base class and `src/features/auth/auth.errors.ts` for the reference implementation. Each feature owns a `<feature>.errors.ts` file that defines its error codes, messages, and HTTP status mapping. The global error handler in `src/middleware/error-handler.ts` handles all `DomainError` instances generically.

## Testing

Route-level integration tests against a real database — no mocking. Hardcode all expected values (error codes, status codes, field names) directly in assertions. Never import production constants as expected values — if a value changes, the test must break to force a deliberate decision.

## Data access

Always scope `select()` to the columns actually needed. Use `db.transaction()` when multiple writes must succeed or fail together. Functions that may be called inside a transaction accept an optional `tx: typeof db | DbTransaction` parameter (see `src/db/index.ts`) defaulting to `db`.
