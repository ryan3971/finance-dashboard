# API — CLAUDE.md

Guidance specific to `apps/api`. See the root [`CLAUDE.md`](../../CLAUDE.md) for monorepo-wide conventions.

## Architecture

### Directory structure (`src/`)

Feature-based modules under `features/`. Features with separate read and write concerns split into two route files (if there are enough endpoints to warrant this separation):

```
features/transactions/
  transactions.routes.ts           # GET routes (Express router)
  transactions-mutation.routes.ts  # POST/PATCH/DELETE routes
  transactions.service.ts          # DB queries and business logic
  transactions.errors.ts           # Domain error codes, messages, HTTP status mapping
  transactions.routes.test.ts
```

Features include: `accounts`, `transactions`, `categories`, `categorization-rules`, `imports`, `rebalancing`, `tags`, `transfers`, `user-config`, `seed` (admin data seeding), and `dashboards/` (see below).

Other top-level directories:
- `db/` — Drizzle schema, migrations. `db/seeders/` contains the seeding scripts; `db/seeds/` holds the seed data organized by environment (`staging/`, `system/`, `test/`)
- `middleware/` — Global error handler (catches `DomainError`, `ZodError`, and `multer` errors) and Pino logger (`httpLogger` request middleware, `closeFileLog()` for graceful shutdown drain)
- `lib/` — Config loader, JWT helpers, `requireAuth` middleware and `getAuthUser` helper (`auth.ts`), API-only constants (`constants.ts`), reusable Zod schemas (`common-schemas.ts`)
- `pipelines/` — Cross-feature logic: `categorization/` (AI + rules engine), `rebalancing/` (adjustment computation for dashboard services), `transfer-detection/`
- `routes/` — Health check route
- `scripts/` — Environment scripts: `dev.ts`, `staging.ts`, `production.ts`, and seed/backfill utilities
- `testing/` — Vitest setup, shared test helpers, fixtures, seeders, seeds, and sample CSV files

Entry: `server.ts` loads config, initialises Sentry (`instrument.ts`), then starts the app defined in `app.ts`.

Config is loaded once at startup via `src/lib/config.ts` — the single source of truth for all env vars in the API.

### Layer responsibilities

- **Route layer** — validate input with Zod, call services, translate `null` to 404, return shaped responses. No business logic.
- **Service layer** — business logic, domain rules. Never uses HTTP status codes. Throws `DomainError` for business rule violations. Does not query the DB directly in dashboard features — receives pre-aggregated data as parameters.
- **DB layer** (Drizzle queries) — data access only. For dashboard features: aggregation only, never returns raw transaction arrays.

## Auth Flow

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

## API Patterns

### Code conventions

- Service functions return data or `null` — the route layer translates `null` to 404. Services do not throw for not-found cases. Exception: mutation functions that verify ownership before writing (e.g. confirm, dismiss) should throw a domain error when the record is not found — returning `null` from a `void` function is meaningless and the route layer has nothing to check.
- Express v5 is in use. Async route handlers do **not** need try/catch — Express v5 automatically forwards rejected promises to error-handling middleware.
- Zod validation happens at the route layer before calling services. Reusable param schemas (e.g. `idParamsSchema`) live in `src/lib/common-schemas.ts` — import from there instead of inlining duplicate schemas in route files.
- `req.user` is typed as optional by Express but is always present after `requireAuth`. Use `getAuthUser(req)` (from `@/lib/auth`) instead of `req.user!` — it throws a descriptive error if called outside a guarded route, catching misuse at runtime rather than silently returning `undefined`.

### Error handling

Services never use HTTP status codes. Business rule violations are thrown as domain errors — see `src/lib/domain-error.ts` for the base class and `src/features/auth/auth.errors.ts` for the reference implementation. Each feature owns a `<feature>.errors.ts` file that defines its error codes, messages, and HTTP status mapping. The global error handler in `src/middleware/error-handler.ts` handles `DomainError` instances generically, and also catches `ZodError` (→ 400) and `multer.MulterError`. Route handlers do not need to catch these.

### Bulk apply-rules endpoint

`POST /api/v1/transactions/apply-rules` runs all of a user's categorization rules against their unresolved transactions (where `categorySource != 'manual'` AND (`categoryId IS NULL OR flaggedForReview = true`), excluding transfers). Returns `{ applied: number, skipped: number }`.

Implementation notes:
- The route is defined **before** `/:id` routes in `transactions-mutation.routes.ts` so Express does not match the literal string `apply-rules` as a transaction id.
- The service (`applyRulesToUncategorized`) loads rules once via `loadRules(userId)`, then groups matching transactions by their categorization outcome fingerprint to issue one `inArray` UPDATE per unique outcome — avoiding one query per transaction.
- `needWant` is coerced to `null` for income transactions at the service layer, matching the behaviour of `patchTransaction`.

### Constants

Before adding a constant, decide where it belongs: if it's needed by the web app too, it goes in `packages/shared/src/constants.ts` — import with `@finance/shared/constants`. If it's API-only and appears in 2+ files, it goes in `src/lib/constants.ts` — import with `@/lib/constants`.

## Data Access

Always scope `select()` to the columns actually needed. Use `db.transaction()` when multiple writes must succeed or fail together. Functions that may be called inside a transaction accept an optional `tx: typeof db | DbTransaction` parameter (see `src/db/index.ts`) defaulting to `db`.

Avoid N+1 query patterns — never issue a `db.select()` inside a loop over rows. Instead, batch with `inArray` before the loop and do in-memory matching per row.

Drizzle returns `numeric` columns as strings. Never use `parseFloat` or other floating-point conversions on money amounts in service or DB logic — use `Decimal.js` for all arithmetic. At the API response boundary, convert to `number` via `new Decimal(s).toNumber()` so the client receives a JSON number. Dashboard response types in `@finance/shared` use `number` (not `string`) for monetary amount fields.

## Dashboard Features

Dashboard routes live in `features/dashboards/`. Each tab is a separate sub-feature with its own route file and service:

```
features/dashboards/
  income/
  expenses/
  snapshot/   (also has snapshot.repository.ts — a repository layer for queries too complex to inline in the service)
  ytd/
```

`anticipated-budget` is a standalone feature at `features/anticipated-budget/`, not under `features/dashboards/`.

**DB queries** use Drizzle `.groupBy()` and aggregate functions (`sql<number>`). They return summary rows, never raw transaction arrays. Scope every query with `userId` from `req.user`.

**Service functions** receive aggregated rows and apply business logic:
- Apply `user_config` percentage fields (`needs_percentage`, `wants_percentage`, `investments_percentage`) to derive target splits
- Compute spending income (income minus investment contributions)
- Compute net income per column (total, wants, needs)
- Apply rebalancing group offsets via `pipelines/rebalancing/rebalancing-adjustments.ts`

**Response shapes** are flat objects or arrays of flat objects — no nested pagination wrappers. Dashboard endpoints are not paginated.

**`user_config` percentage fields** sum to 100 and are validated at the API boundary with Zod. Applied to income side only — not used to classify expense transactions.

**Anticipated budget schema:**
- `anticipated_budget` — one row per named entry (`id`, `userId`, `categoryId` FK, `name`, `need_want`, `is_income`, `monthly_amount` nullable, `notes` nullable, `effective_year`)
- `anticipated_budget_months` — per-month overrides (`id`, `anticipated_budget_id` FK, `month` 1–12, `amount`)
- If no override rows exist, `monthly_amount` applies to all 12 months
- If only override rows exist (e.g. car insurance), the entry is irregular — months without a row contribute zero

**Running balances** are computed from transaction history (`SUM(amount)` ordered by date) — there is no denormalised balance column in the accounts table. Always derive current balance from transactions. A snapshot pattern (materialised balance) is deferred.

## Testing Strategy

Tests live in `src/testing/`. The suite is integration-only — there are no separate unit test files. Tests run serially against a real database (`finance_test`) to avoid race conditions.

### What to assert

- Assert against the external contract (status codes, response body fields, side effects) — never against internal implementation details.
- If you can refactor internals without changing observable behavior, tests should stay green. If observable behavior changes, tests should fail.

### Hardcoding values

- Always hardcode expected values in assertions (status codes, field values, error messages). Never derive them dynamically from the application code under test.
- Use `toMatchObject` over deep equality when only a subset of fields defines the contract. This keeps tests resilient to additive changes (new fields) while still catching regressions on the fields that matter.

### Schema / type validation

- Do not import Zod schemas or shared type definitions into tests. If the schema changes, the test should catch it — importing the same schema means both sides change together and the regression is silently missed.
- Define expected shapes inline in the test as a local interface or inline cast. This also serves as documentation of the endpoint contract.

### Handling `any` on response bodies

Cast response bodies to a local interface to resolve unsafe member access lint errors:

```ts
interface ResponseBody {
  year: number;
  title: string;
}
const body = response.body as ResponseBody;
expect(body.year).toBe(2024);
```

- Type casts on response bodies are acceptable in tests. The assertions that follow are the actual safety net — the cast just satisfies the type checker.
- Do not cast inputs to the functions/services under test. Those should be properly typed so TypeScript catches mismatches between test data and function signatures.
- Do not suppress lint errors with `eslint-disable` or `as any`.

## Observability

HTTP request logging uses Pino via `httpLogger` middleware (mounted in `app.ts`). Log level is configured via `LOG_LEVEL` env var (`debug | info | warn | error`) in `src/lib/config.ts`.

On graceful shutdown, call `closeFileLog()` (from `src/middleware/`) to drain the write stream before the process exits — `logger.flush()` alone is not sufficient.

## AI Categorization

Pluggable provider (Anthropic or OpenAI) configured via `AI_PROVIDER` env var. Disabled by default (`ENABLE_AI_CATEGORIZATION=false`) to avoid API costs in development.
