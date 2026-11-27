# API — CLAUDE.md

`apps/api` specifics. Monorepo-wide conventions (dashboard layer rules, `@finance/shared` imports,
type assertions) are in the root [`CLAUDE.md`](../../CLAUDE.md).

Writing or changing a test → read [`docs/testing.md`](docs/testing.md).

Endpoint request and response shapes live in the Bruno collection (`bruno/`, one folder per feature)
and the Zod schemas in `packages/shared/src/schemas/`. This file carries the invariants and reasons
behind the endpoints, which those sources do not state.

## Layout (`src/`)

One folder per feature under `features/`. A feature with enough endpoints to warrant it splits reads
and writes into two route files:

```
features/transactions/
  transactions.routes.ts           # GET routes (Express router)
  transactions-mutation.routes.ts  # POST/PATCH/DELETE routes
  transactions.service.ts          # DB queries and business logic
  transactions.errors.ts           # Domain error codes, messages, HTTP status mapping
  transactions.routes.test.ts
```

`pipelines/` holds logic shared across features: `categorization/` (AI providers + rules engine),
`investments/` (the investment insert path), `rebalancing/` (adjustments consumed by dashboard
services), `transfer-detection/`. `src/lib/config.ts` loads config once at startup and is the single
source of truth for env vars.

## Layer responsibilities

- **Route** — validate input with Zod (reusable param schemas such as `idParamsSchema` come from
  `src/lib/common-schemas.ts`), call services, shape the response. Business logic stays out.
- **Service** — business logic and domain rules, throwing `DomainError` for violations. HTTP status
  codes never appear here.
- **DB** (Drizzle) — data access only.

Service functions return data or `null`, and the route layer turns `null` into a 404. The exception
is a mutation that verifies ownership before writing (confirm, dismiss): those throw a domain error,
since `null` out of a `void` function tells the route layer nothing.

## Code conventions

- Express v5 forwards rejected promises to error middleware on its own, so async route handlers need
  no try/catch. (One deliberate exception: SSE, below.)
- `req.user` is typed optional by Express but is always set after `requireAuth`. Use
  `getAuthUser(req)` from `@/lib/auth` rather than `req.user!` — it throws a descriptive error when
  called outside a guarded route, turning misuse into a runtime failure instead of a silent
  `undefined`.
- An API-only constant used in 2+ files belongs in `src/lib/constants.ts` (`@/lib/constants`).

## Error handling

Business rule violations are thrown as domain errors: `src/lib/domain-error.ts` holds the base class
and `src/features/auth/auth.errors.ts` is the reference implementation. Each feature owns a
`<feature>.errors.ts` defining its codes, messages, and HTTP status mapping. The global handler in
`src/middleware/error-handler.ts` handles `DomainError` generically plus `ZodError` (→ 400) and
`multer.MulterError`, so route handlers catch none of them.

## Auth flow

Access token is a short-lived JWT sent as `Authorization: Bearer`. The refresh token is a
longer-lived JWT in an HttpOnly cookie scoped to path `/api/v1/auth`, rotated on each use.
`requireAuth` validates the Bearer token and attaches `req.user` (`{ id, email }`).

## Database

PostgreSQL 15 via Docker (`docker-compose.yml`), Drizzle ORM with generated migrations. Dev
database `finance_dev`, test database `finance_test`; schema is `src/db/schema.ts`.

Drizzle names migration files itself — leave those names alone. After generating one, run
`pnpm db:migrate` (dev) or `pnpm --filter api db:migrate:test` (test). The ECS deploy pipeline runs
migrations as a one-off task before updating the service, so a migration ships in the same commit as
the API change that needs it.

## Data access

Scope `select()` to the columns actually needed. Use `db.transaction()` when multiple writes must
succeed or fail together; a function that may run inside one takes an optional
`tx: typeof db | DbTransaction` parameter (see `src/db/index.ts`) defaulting to `db`.

Batch queries with `inArray` before a loop and match in memory per row — a `db.select()` inside a
loop over rows is the N+1 pattern this rule exists to prevent.

Drizzle returns `numeric` columns as strings. Money arithmetic in service and DB logic goes through
`Decimal.js`; `parseFloat` and other floating-point conversions lose precision. At the response
boundary, convert with `new Decimal(s).toNumber()` so the client gets a JSON number — dashboard
response types in `@finance/shared` type monetary fields as `number`.

## Feature invariants

**Investment transactions** — an account must belong to the authenticated user (→ 403) and be an
investment type (tfsa, fhsa, rrsp, non-registered) (→ 400 `INVALID_ACCOUNT_TYPE_FOR_TRANSACTION`).
Duplicate detection uses `compositeKey`, the same algorithm as the import pipeline, returning 409
`DUPLICATE_INVESTMENT_TRANSACTION` on collision. `insertInvestmentTransaction` in
`pipelines/investments/investment-insert.ts` is the single insert path, shared by the import pipeline
(`processInvestmentRow`) and manual entry — both provenances flow through it, distinguished by the
`source` column (`'csv'` | `'manual'`). The client applies the sign to `amount` before posting and
the API stores it as-is; the service sets `rawAction` equal to `action`.

**Wildcard rules** — `matchType: 'wildcard'` supports `*` (any chars) and `?` (one char), anchored
`^...$`, so substring matching needs an explicit `*` prefix or suffix. Implemented by
`descriptionMatchesRule` in `pipelines/categorization/rules-engine.ts`.

**Bulk apply-rules** (`POST /api/v1/transactions/apply-rules`) — the candidate query
(`fetchRuleApplicableTransactions`) targets non-transfer transactions with
`categorySource IN ('default', 'ai')`, which rules overwrite, implicitly excluding manual and
already-rule-applied transactions. This replaced a `categoryId IS NULL OR flaggedForReview = true`
filter that missed AI-categorized transactions. Three things hold it together: the route is
registered **before** the `/:id` routes in `transactions-mutation.routes.ts` so Express does not read
`apply-rules` as an id; the service (`applyRulesToUncategorized`) loads rules once via
`loadRules(userId)` and groups matches by categorization outcome to issue one `inArray` UPDATE per
unique outcome rather than one per transaction; and `needWant` is coerced to `null` for income
transactions, matching `patchTransaction`.

**Retroactive rule application** — creating a rule through `POST /rule-suggestions/:id/accept`, or
`PATCH /transactions/:id` with `createRule: true` and no existing rule for the keyword, calls
`applyRuleRetroactively` inside the **same DB transaction** as the rule creation. It applies the
bulk endpoint's candidate filter scoped to the one new rule, and both endpoints return
`retroactivelyApplied: number`. `applyRuleRetroactively(tx, rule, userId)` is exported from
`transactions.service.ts` and imported by `rule-suggestions.service.ts`, keeping transaction logic
in one place; `RetroactiveRule` is the exported parameter interface, a subset of `LoadedRule`. When a
rule already existed for the keyword, `retroactivelyApplied` is `0`. The patched transaction excludes
itself from candidates because its `categorySource` is `'manual'` by the time the call runs.

**Rule suggestions** — generated during import when the AI categorizes a transaction with
`categorySource = 'ai'` (`maybeSuggestRule` in `import.service.ts`). A partial unique index on
`(user_id, lower(suggested_keyword)) WHERE status = 'pending'` enforces deduplication. Accept coerces
`needWant = 'NA'` → `null` before calling `createRule`. Both mutating endpoints return 409 when the
suggestion is already accepted or dismissed.

**`isInvestmentContribution`** on `PATCH /api/v1/transactions/:id` marks an outgoing contribution
(e.g. a bank debit to Questrade). It lands in `monthlyIncome.actualInvestments` on the snapshot,
reducing `spendingIncome`, and is excluded from `monthlyExpenses` totals to prevent double-counting.
It is independent of `isTransfer`: a contribution also detected as a transfer is excluded from income
via the transfer path and from expenses via both filters.

**SSE streaming** — `POST /api/v1/imports/upload/stream` wraps `processImport` in try/catch
deliberately, against the Express 5 convention above. `res.flushHeaders()` has already run by the
time the async work starts, so the response body is open and Express's error middleware cannot write
a JSON error into it. The catch emits a `{ stage: 'error', message }` SSE event and the finally block
calls `res.end()`. Keep this try/catch.

## Dashboard features

Dashboard routes live in `features/dashboards/`, one sub-feature per tab: `income/`, `expenses/`,
`snapshot/`, `ytd/`. Investments and anticipated-budget are top-level features, not dashboard
sub-features, even though the web app presents them as dashboard tabs.

The root layer rules map onto functions, not files. A dashboard service exports async `query*`
functions (Drizzle `.groupBy()` + `sql<number>` aggregates, scoped by `userId`) and a pure
`build*Response` function that takes those rows as parameters, along with the user config and
rebalancing adjustments (`pipelines/rebalancing/rebalancing-adjustments.ts`) where it needs them. The route runs the queries in
parallel and passes the results to the builder. `snapshot/` moves its queries out to
`snapshot.repository.ts`, leaving its service builder-only.

Spending income is income minus investment contributions. Responses are flat objects or arrays of
them; dashboard endpoints are not paginated.

**`user_config` percentages** sum to 100, validated at the API boundary with Zod, and apply to the
income side only — they never classify expense transactions.

**Anticipated budget schema** — `anticipated_budget` holds one row per named entry (`id`, `userId`,
`categoryId` FK, `name`, `need_want`, `is_income`, `monthly_amount` nullable, `notes` nullable,
`effective_year`), and `anticipated_budget_months` holds per-month overrides (`id`,
`anticipated_budget_id` FK, `month` 1–12, `amount`). With no override rows, `monthly_amount` applies
to all 12 months. With only override rows (car insurance, say), the entry is irregular and months
without a row contribute zero.

**Running balances** are derived from transaction history (`SUM(amount)` ordered by date) — the
accounts table carries no denormalised balance column, and a materialised snapshot pattern is
deferred.

## Observability

HTTP request logging is Pino via `httpLogger` (`src/middleware/logger.ts`), mounted in `app.ts`, at
the level set by `LOG_LEVEL`. On graceful shutdown call `closeFileLog()` from the same file to drain
the write stream — `logger.flush()` alone leaves writes in flight.

## AI categorization

Providers (Anthropic, OpenAI) live in `pipelines/categorization/`, selected by `AI_PROVIDER`.
