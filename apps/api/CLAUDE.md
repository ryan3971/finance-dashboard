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
- `lib/` — Config loader, JWT helpers, shared API constants (`constants.ts`)
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

Drizzle generates migration filenames automatically — do not rename them. Run `pnpm db:migrate` (dev) or `pnpm --filter api db:migrate:test` (test) after generating a new migration. The ECS deploy pipeline runs migrations as a one-off task before updating the service — never deploy API changes that require a migration without including the migration in the same commit.

## AI categorization

Pluggable provider (Anthropic or OpenAI) configured via `AI_PROVIDER` env var. Disabled by default (`ENABLE_AI_CATEGORIZATION=false`) to avoid API costs in development.

## Constants

API-only literals that appear in 2+ files belong in `src/lib/constants.ts` — import with `@/lib/constants`. This includes import pipeline statuses (`IMPORT_STATUS`), categorization sources (`CATEGORY_SOURCE`), transaction sources (`TRANSACTION_SOURCE`), the ISO date regex (`ISO_DATE_REGEX`), AI provider parameters (`AI_MAX_TOKENS`, `AI_TEMPERATURE`), and other magic values. Values needed by the web app too belong in `packages/shared/src/constants.ts` instead.

## Code conventions

- Service functions return data or `null` — the route layer translates `null` to 404. Services do not throw for not-found cases. Exception: mutation functions that verify ownership before writing (e.g. confirm, dismiss) should throw a domain error when the record is not found — returning `null` from a `void` function is meaningless and the route layer has nothing to check.
- Express v5 is in use. Async route handlers do **not** need try/catch — Express v5 automatically forwards rejected promises to error-handling middleware.
- Zod validation happens at the route layer before calling services. Reusable param schemas (e.g. `idParamsSchema`) live in `src/lib/common-schemas.ts` — import from there instead of inlining duplicate schemas in route files.
- `req.user` is typed as optional by Express but is always present after `requireAuth`. Use `getAuthUser(req)` (from `@/lib/auth`) instead of `req.user!` — it throws a descriptive error if called outside a guarded route, catching misuse at runtime rather than silently returning `undefined`.

## Error handling

Services never use HTTP status codes. Business rule violations are thrown as domain errors — see `src/lib/domain-error.ts` for the base class and `src/features/auth/auth.errors.ts` for the reference implementation. Each feature owns a `<feature>.errors.ts` file that defines its error codes, messages, and HTTP status mapping. The global error handler in `src/middleware/error-handler.ts` handles all `DomainError` instances generically.

## Testing

Route-level integration tests against a real database — no mocking. Hardcode all expected values (error codes, status codes, field names) directly in assertions. Never import production constants as expected values — if a value changes, the test must break to force a deliberate decision.

## Data access

Always scope `select()` to the columns actually needed. Use `db.transaction()` when multiple writes must succeed or fail together. Functions that may be called inside a transaction accept an optional `tx: typeof db | DbTransaction` parameter (see `src/db/index.ts`) defaulting to `db`.

Avoid N+1 query patterns — never issue a `db.select()` inside a loop over rows. Instead, batch with `inArray` before the loop and do in-memory matching per row.

Drizzle returns `numeric` columns as strings. Never use `parseFloat` or other floating-point conversions on money amounts — use string manipulation or a decimal library to preserve precision.

## Dashboard features

Dashboard routes live in `features/dashboards/`. Each tab is a separate sub-feature with its own route file and service:

```
features/dashboards/
  income/
    income.routes.ts
    income.service.ts
  expenses/
    expenses.routes.ts
    expenses.service.ts
  snapshot/
    snapshot.routes.ts
    snapshot.service.ts
  ytd/
    ytd.routes.ts
    ytd.service.ts
  anticipated-budget/
    anticipated-budget.routes.ts
    anticipated-budget.service.ts
```

**DB queries** use Drizzle `.groupBy()` and aggregate functions (`sql<number>`). They return summary rows, never raw transaction arrays. Scope every query with `userId` from `req.user`.

**Service functions** receive aggregated rows and apply business logic:
- Apply `user_config` percentage fields (`needs_percentage`, `wants_percentage`, `investments_percentage`) to derive target splits
- Compute spending income (income minus investment contributions)
- Compute net income per column (total, wants, needs)

**Service functions do not** query the DB themselves — they receive pre-aggregated data as parameters. This keeps DB logic and business logic testable in isolation.

**Response shapes** are flat objects or arrays of flat objects — no nested pagination wrappers. Dashboard endpoints are not paginated.

**`user_config` percentage fields** sum to 100 and are validated at the API boundary with Zod. Applied to income side only — not used to classify expense transactions.

**Anticipated budget schema:**
- `anticipated_budget` — one row per named entry (`id`, `userId`, `categoryId` FK, `name`, `need_want`, `is_income`, `monthly_amount` nullable, `notes` nullable, `effective_year`)
- `anticipated_budget_months` — per-month overrides (`id`, `anticipated_budget_id` FK, `month` 1–12, `amount`)
- If no override rows exist, `monthly_amount` applies to all 12 months
- If only override rows exist (e.g. car insurance), the entry is irregular — months without a row contribute zero

**Running balances** are computed from transaction history (`SUM(amount)` ordered by date) — there is no denormalised balance column in the accounts table. Always derive current balance from transactions. A snapshot pattern (materialised balance) is deferred.
