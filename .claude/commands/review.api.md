You are performing a comprehensive code review of the `apps/api` workspace of an Express 5 REST API built with Node.js/TypeScript, Drizzle ORM, PostgreSQL 15, Vitest, and Zod. The codebase is a personal finance dashboard backend.

## Codebase Structure

- `src/features/<name>/` — each feature contains: `<name>.routes.ts`, `<name>-mutation.routes.ts` (if applicable), `<name>.service.ts`, `<name>.errors.ts`, `<name>.routes.test.ts`
- `src/db/` — Drizzle ORM schema (`schema.ts`), migrations, seeds
- `src/lib/` — `config.ts` (env vars), `domain-error.ts` (base error class), `auth.ts` (`getAuthUser()`), `jwt.ts`, `common-schemas.ts` (reusable Zod param schemas)
- `src/middleware/` — `error-handler.ts` (global), `logger.ts`
- `src/pipelines/` — cross-feature logic (categorization AI/rules engine, rebalancing hooks, transfer detection)
- `src/testing/` — Vitest setup, test helpers, fixtures, seeders

## Architecture Rules to Enforce

1. **Layer separation** — DB layer aggregates and filters; service layer applies business logic; routes handle validation and call services. Services never contain HTTP concepts (no `res.status()`, no status codes).
2. **Services return data or null** — routes translate `null` to 404. Services never throw HTTP errors.
3. **Domain errors** — business rule violations throw subclasses of `DomainError` from `lib/domain-error.ts`. The global error handler maps them to HTTP responses via feature `*.errors.ts`.
4. **Express v5 async** — async route handlers do not need try/catch; Express v5 forwards thrown errors to the error handler automatically.
5. **Auth extraction** — always use `getAuthUser(req)` from `lib/auth.ts`, never `req.user!`.
6. **Zod validation at route layer** — all incoming request bodies and params are validated with Zod before reaching the service. Reusable schemas live in `lib/common-schemas.ts`.
7. **Drizzle numeric → Decimal** — columns typed `numeric` in Drizzle return strings at runtime. All arithmetic on monetary values must use `Decimal.js`. Convert to `number` only at the API boundary (before JSON serialization).
8. **Dashboard DB queries** — must aggregate in SQL (`sum()`, `avg()`, grouping), never fetch raw rows and reduce in JavaScript.
9. **Multi-write consistency** — operations touching multiple tables use `db.transaction()`.
10. **No barrel files** — no `index.ts` re-exports inside `apps/api`.
11. **Shared package imports** — sub-path imports only (`@finance/shared/schemas/auth`, etc.). Never the bare `@finance/shared` root.
12. **Type assertions** — avoid `as SomeType`. Use type guards, Zod parse, or narrowing at source.

## Review Checklist

For every file you examine, assess:

### Correctness
- Are SQL queries correct? Check joins, WHERE clauses, GROUP BY correctness, and NULL handling.
- Are `numeric` Drizzle columns being used in arithmetic without `Decimal.js` (a silent precision bug)?
- Are `db.transaction()` wrappers missing where multiple writes must be atomic?
- Are there race conditions in multi-step service logic?
- Are pagination parameters (offset/limit) applied correctly and validated to prevent negative or excessively large values?

### Security
- Is every protected route checking the authenticated user owns the resource (tenant isolation)? A route that fetches `accountId` from params but queries without `userId` filter is a data-leak bug.
- Are there SQL injection risks from dynamic query construction (raw SQL strings, unparameterized values)?
- Are JWT tokens validated before trusting any claims?
- Are file upload handlers (imports) validating MIME type and file size, not just relying on extension?
- Is sensitive data (tokens, passwords) ever logged?

### Architecture Adherence
- Do services contain HTTP concepts (status codes, `res` references)?
- Do routes perform business logic that belongs in the service?
- Do DB queries return raw rows that the service then reduces (violating dashboard layer rules)?
- Are domain errors being thrown correctly or is the code using generic `Error` or hardcoded HTTP throws?

### Error Handling
- Are all domain error subtypes mapped in the feature's `*.errors.ts`?
- Does the global error handler cover all error shapes (Zod errors, Drizzle errors, unexpected errors)?
- Are there unhandled promise rejections in async pipeline code?

### Type Safety
- Are `as` assertions hiding type gaps that should be fixed with a type guard or Zod schema?
- Are Drizzle query results typed correctly, or widened with `any`?
- Are route handler parameter types precise (validated Zod output types, not `req.body: any`)?

### Test Quality (for `*.routes.test.ts` and `*.service.test.ts`)
- Do tests import Zod schemas to construct test data? (They shouldn't — this couples tests to implementation; use plain object literals.)
- Do tests assert the external contract (HTTP status codes, response shape) or only internal implementation?
- Are tests resetting DB state between runs using the seeder helpers in `testing/seeders/`?
- Are there happy-path tests without corresponding error/edge-case coverage?
- Are fixtures in `testing/fixtures/` used consistently, or is test data duplicated inline?

### Code Quality
- Is there dead code (unused imports, commented-out blocks, unreachable branches)?
- Are there hardcoded magic numbers or strings that should be constants in `lib/constants.ts`?
- Are environment variables read directly from `process.env` instead of going through `lib/config.ts`?
- Are logging calls (if any) structured and consistent?

## Deliverable

For each issue found, provide:
1. **File path and line number** (e.g., `src/features/transactions/transactions.service.ts:87`)
2. **Severity** — Critical / High / Medium / Low
3. **Category** — Bug / Security / Architecture Violation / Type Safety / Test Quality / Code Quality
4. **Description** — what is wrong and why it matters
5. **Fix** — the corrected code or the specific change needed

Group findings by feature folder. Flag Security and Critical issues first in each group. At the end, provide a summary table with total counts per severity and category.