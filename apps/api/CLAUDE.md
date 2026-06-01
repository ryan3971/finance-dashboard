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

Features include: `accounts`, `transactions`, `categories`, `categorization-rules`, `rule-suggestions`, `imports`, `rebalancing`, `tags`, `transfers`, `user-config`, `seed` (admin data seeding), and `dashboards/` (see below).

Other top-level directories:
- `db/` — Drizzle schema, migrations. `db/seeders/` contains the seeding scripts; `db/seeds/` holds the seed data organized by environment (`staging/`, `system/`, `test/`)
- `middleware/` — Global error handler (catches `DomainError`, `ZodError`, and `multer` errors) and Pino logger (`httpLogger` request middleware, `closeFileLog()` for graceful shutdown drain)
- `lib/` — Config loader, JWT helpers, `requireAuth` middleware and `getAuthUser` helper (`auth.ts`), API-only constants (`constants.ts`), reusable Zod schemas (`common-schemas.ts`)
- `pipelines/` — Cross-feature logic: `categorization/` (AI + rules engine), `rebalancing/` (adjustment computation for dashboard services), `transfer-detection/`, `refund-detection/`
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
- Tests run in parallel (`fileParallelism: true`). Isolation is achieved by scoping all data to a per-worker user ID — see `src/testing/test-helpers.ts`.

Drizzle generates migration filenames automatically — do not rename them. Run `pnpm db:migrate` (dev) or `pnpm --filter api db:migrate:test` (test) after generating a new migration. The ECS deploy pipeline runs migrations as a one-off task before updating the service — never deploy API changes that require a migration without including the migration in the same commit.

## API Patterns

### Code conventions

- Service functions return data or `null` — the route layer translates `null` to 404. Services do not throw for not-found cases. Exception: mutation functions that verify ownership before writing (e.g. confirm, dismiss) should throw a domain error when the record is not found — returning `null` from a `void` function is meaningless and the route layer has nothing to check.
- Express v5 is in use. Async route handlers do **not** need try/catch — Express v5 automatically forwards rejected promises to error-handling middleware.
- Zod validation happens at the route layer before calling services. Reusable param schemas (e.g. `idParamsSchema`) live in `src/lib/common-schemas.ts` — import from there instead of inlining duplicate schemas in route files.
- `req.user` is typed as optional by Express but is always present after `requireAuth`. Use `getAuthUser(req)` (from `@/lib/auth`) instead of `req.user!` — it throws a descriptive error if called outside a guarded route, catching misuse at runtime rather than silently returning `undefined`.

### Error handling

Services never use HTTP status codes. Business rule violations are thrown as domain errors — see `src/lib/domain-error.ts` for the base class and `src/features/auth/auth.errors.ts` for the reference implementation. Each feature owns a `<feature>.errors.ts` file that defines its error codes, messages, and HTTP status mapping. The global error handler in `src/middleware/error-handler.ts` handles `DomainError` instances generically, and also catches `ZodError` (→ 400) and `multer.MulterError`. Route handlers do not need to catch these.

### Investment transaction endpoints

`GET /api/v1/investments/transactions` — paginated list of investment transactions for the authenticated user, with optional filters (`accountId`, `action`, `symbol`, `startDate`, `endDate`). Response includes `source: 'csv' | 'manual'` on each row.

`POST /api/v1/investments/transactions` — create a manual investment transaction. Body validated against `createManualInvestmentTransactionSchema` (`packages/shared/src/schemas/investments.ts`). The client applies the sign to `amount` before posting; the API stores it as-is. `rawAction` is set equal to `action` by the service. Returns `201` with `InvestmentTransactionRow`.

Key behaviours:
- Account must belong to the authenticated user (→ 403) and must be an investment account type (tfsa, fhsa, rrsp, non-registered) (→ 400 `INVALID_ACCOUNT_TYPE_FOR_TRANSACTION`).
- Duplicate detection uses `compositeKey` (same algorithm as the import pipeline). A collision returns 409 `DUPLICATE_INVESTMENT_TRANSACTION`.
- `insertInvestmentTransaction` in `investments.repository.ts` is the single shared insert path used by both the import pipeline (`processInvestmentRow`) and manual entry. Do not add a second insert path.
- `source` column on `investment_transactions` distinguishes provenance: `'csv'` for imported rows, `'manual'` for entries created via this endpoint.

`GET /api/v1/investments/monthly-breakdown?year=` — combined 12-month breakdown (contributed, deployed, uninvestedDelta, target) plus an `accounts` array of per-account breakdowns. Each account entry includes `annualLimit` (from `contributionRecords`) and its own 12-month rows and totals. Account ordering: TFSA → RRSP → FHSA → non-registered.

`GET /api/v1/investments/contribution-room?year=` — per-registered-account contribution room. Supports a TFSA carry-forward estimate from prior-year data.

`PUT /api/v1/investments/contribution-room/:accountId/:year` — upsert the `annualLimit`, `roomCarried`, and `roomCarriedConfirmed` fields for a registered account. Returns 204.

### Categorization rules endpoints

`GET /api/v1/categorization-rules` — returns all rules for the authenticated user, ordered by priority descending. Each rule includes `matchType: 'substring' | 'wildcard'`.

`POST /api/v1/categorization-rules` — creates a new rule; returns `201` with the full rule shape including joined `categoryName`/`subcategoryName`.

`PATCH /api/v1/categorization-rules/:id` — partial update; accepts `matchType` along with all other rule fields.

`DELETE /api/v1/categorization-rules/:id` — deletes the rule.

Rules with `matchType: 'wildcard'` use `*` (any chars) and `?` (one char) wildcards. The pattern is anchored (`^...$`) — add `*` prefix/suffix to match substrings. Implemented in `rules-engine.ts` via `descriptionMatchesRule`.

### Bulk apply-rules endpoint

`POST /api/v1/transactions/apply-rules` runs all of a user's categorization rules against eligible transactions, excluding transfers. Returns `{ applied: number, skipped: number }`.

**Candidate query** (`fetchRuleApplicableTransactions`): targets `categorySource IN ('default', 'ai')` — rules overwrite both. Manual and rule-applied transactions are excluded implicitly. This replaced the previous `categoryId IS NULL OR flaggedForReview = true` filter, which was missing AI-categorized transactions.

Implementation notes:
- The route is defined **before** `/:id` routes in `transactions-mutation.routes.ts` so Express does not match the literal string `apply-rules` as a transaction id.
- The service (`applyRulesToUncategorized`) loads rules once via `loadRules(userId)`, then groups matching transactions by their categorization outcome fingerprint to issue one `inArray` UPDATE per unique outcome — avoiding one query per transaction.
- `needWant` is coerced to `null` for income transactions at the service layer, matching the behaviour of `patchTransaction`.

### PATCH /api/v1/transactions/:id

Accepted body fields: `categoryId`, `subcategoryId`, `needWant`, `note`, `createRule`, `isInvestmentContribution`. All optional.

`isInvestmentContribution: boolean` — marks a transaction as an outgoing investment contribution (e.g. a bank debit to Questrade). When true, the transaction is:
- Included in `monthlyIncome.actualInvestments` on the snapshot, reducing `spendingIncome`.
- Excluded from `monthlyExpenses` totals (in addition to the existing `isTransfer` exclusion) to prevent double-counting.

This flag is independent of `isTransfer`. A contribution that is also detected as a transfer will be handled correctly — it is excluded from income already via the transfer path and excluded from expenses via both the transfer and contribution filters.

### Retroactive rule application

When a rule is created via `POST /rule-suggestions/:id/accept` or via `PATCH /transactions/:id` with `createRule: true` (and no existing rule for the same keyword), `applyRuleRetroactively` is called within the **same DB transaction** as rule creation. It applies the same candidate filter as the bulk apply-rules endpoint (`categorySource IN ('default', 'ai')`, non-transfer) but scoped to the single new rule. Both endpoints return `retroactivelyApplied: number` alongside their normal response fields.

- `applyRuleRetroactively(tx, rule, userId)` is exported from `transactions.service.ts` and imported by `rule-suggestions.service.ts` to keep transaction logic in one place.
- `RetroactiveRule` is the exported interface for the rule parameter — a subset of `LoadedRule` fields sufficient for matching and categorization.
- For `patchTransaction`: if a rule already existed for the keyword, `retroactivelyApplied` is `0` (no new rule created, no retroactive work done).
- The patched transaction itself is excluded from retroactive candidates because its `categorySource` is set to `'manual'` before `applyRuleRetroactively` runs.

### Rule suggestions endpoints

`GET /api/v1/rule-suggestions` — returns all `pending` suggestions for the authenticated user, ordered by confidence descending. Suggestions are generated automatically during import when the AI categorizes a transaction with `categorySource = 'ai'` (see `maybeSuggestRule` in `import.service.ts`). Deduplication is enforced by a partial unique index on `(user_id, lower(suggested_keyword)) WHERE status = 'pending'`.

`POST /api/v1/rule-suggestions/:id/accept` — body overrides are optional; omitting uses the suggestion's stored values. Coerces `needWant = 'NA'` → `null` before calling `createRule`. Runs in a DB transaction. After the rule is created, calls `applyRuleRetroactively` (exported from `transactions.service.ts`) to immediately update all eligible transactions (`categorySource IN ('default', 'ai')`, non-transfer) that match the new rule's keyword. Returns `201` with `{ ...ruleFields, retroactivelyApplied: number }`.

`POST /api/v1/rule-suggestions/:id/dismiss` — marks `status = 'dismissed'`. Returns `204`.

Both mutating endpoints return `409` if the suggestion is already accepted or dismissed.

### Refund detection endpoints

`POST /api/v1/rebalancing/detect-refunds` — scans all eligible same-account transactions for inverse-amount pairs within the user's configured `refundDetectionWindowDays` (default 90, falls back to `REFUND_DETECTION_WINDOW_DAYS` constant if not set). Returns `{ created: number }`. For each matched pair, creates an **open rebalancing group** with `type = 'refund'`, the charge as `role = 'source'`, and the credit as `role = 'offset'`. This route is placed before `/:id` routes in `rebalancing.routes.ts` to prevent Express matching the literal string `detect-refunds` as an id. Detection is idempotent — transactions already in any group are excluded from candidacy.

**Rebalancing group `type` field:** `rebalancing_groups.type` is either `'rebalancing'` (investment rebalancing, the historical default) or `'refund'`. All existing endpoints (`GET /groups`, `POST /groups`, `PATCH /groups/:id`, `DELETE /groups/:id`, `POST /groups/:id/transactions`, `DELETE /groups/:id/transactions/:txId`) work transparently for both types.

**Dashboard exclusion for refund groups:** Resolved refund groups are excluded from all dashboard aggregates via a NOT IN subquery (`transaction.id NOT IN (SELECT ... WHERE rg.type = 'refund' AND rg.status = 'resolved')`). This is applied at the DB query layer in expenses, income, snapshot, and ytd services — both sides of the pair (charge + credit) are excluded entirely. Investment rebalancing groups use the proportional adjustment pipeline in `rebalancing-adjustments.ts` instead. The adjustment pipeline filters `type = 'rebalancing'` only, so refund groups never enter it.

**Detection window in user_config:** `transferDetectionWindowDays` and `refundDetectionWindowDays` are nullable integers on `user_config`. When null, the detection pipelines fall back to the shared constants (`TRANSFER_DETECTION_WINDOW_DAYS = 3`, `REFUND_DETECTION_WINDOW_DAYS = 90`). The `PATCH /api/v1/user-config` endpoint accepts both fields.

### SSE streaming routes

`POST /api/v1/imports/upload/stream` uses Server-Sent Events. The handler intentionally wraps `processImport` in try/catch **despite Express 5's automatic async error propagation** — because `res.flushHeaders()` has already been called before the async work begins, leaving the SSE response body open. Express's error middleware cannot write a JSON error body to an already-open stream. The catch block emits a `{ stage: 'error', message }` SSE event and the finally block calls `res.end()`. Do not remove this try/catch or replace it with Express propagation.

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

Tests live in `src/testing/`. The suite is integration-only — there are no separate unit test files. Tests run in parallel against a real database (`finance_test`). Each worker uses a unique email suffix (injected by `registerUser()`) so users created by different workers never collide on the unique constraint. `cleanDatabase()` deletes only rows owned by users registered in the current file — system rows (`userId IS NULL`) are never touched.

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
