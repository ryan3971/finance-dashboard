# Changelog

Pre-commit (.husky/pre-commit):

- lint-staged — runs ESLint with --fix on staged .ts/.tsx files only (fast, not the whole repo). Fails on any remaining errors or warnings after auto-fix.
- pnpm typecheck — runs tsc --noEmit across both api and web workspaces.

Pre-push (.husky/pre-push):

- pnpm test — runs the full Vitest suite. Kept out of pre-commit because API tests need the database.
  Tests are in pre-push rather than pre-commit so normal WIP commits aren't blocked by the DB requirement. If you ever want to skip hooks for a one-off commit (e.g. a docs change), you can use git commit --no-verify.

---

Root cause: categorization_rules has a FK → users with ON DELETE no action, so Postgres blocks deleting a user while categorization rule rows still reference it. The teardown order was missing categorizationRules before users.

Fix applied to all 7 route test files:

Added categorizationRules to the schema import
Added await db.delete(categorizationRules) between refreshTokens and users in each beforeEach

---

New file: test-helpers.ts

registerAndLogin(app, email?) — typed return via AuthResponse
createAccount(app, token, options) — typed return via AccountResponse
Exported interfaces: AuthResponse, AccountResponse, ImportSummaryResponse, PaginatedResponse<T>
Updated (7 files) — all local registerAndLogin/createAccount duplicates removed, replaced with imports from the helper. Inline res.body.\* accesses cast through the appropriate typed interface:

transactions.routes.test.ts — PaginatedResponse<T> casts per assertion
imports.routes.test.ts — ImportSummaryResponse + PaginatedResponse casts; AMEX_ACCOUNT constant to avoid repetition
accounts.routes.test.ts — AccountResponse casts
cibc-import.routes.test.ts — ImportSummaryResponse casts; CIBC_ACCOUNT constant
td-import.routes.test.ts — ImportSummaryResponse casts; TD_ACCOUNT constant
questrade-import.routes.test.ts — ImportSummaryResponse casts; beforeEach now uses the shared helpers
auth.routes.test.ts — AuthResponse casts on register/login body access

---

@typescript-eslint/naming-convention (identifier naming, global):

Selector Allowed formats Notes
variable camelCase, PascalCase, UPPER_CASE React component vars + constants
function camelCase, PascalCase Hooks/utils + React components
parameter camelCase \_prefix allowed for unused
typeLike PascalCase interfaces, types, classes, enums
enumMember UPPER_CASE, PascalCase
import camelCase, PascalCase Named + default imports
objectLiteralProperty / typeProperty unrestricted External data shapes (DB/AI/API)
variable + destructured unrestricted Destructuring from external data
check-file/filename-naming-convention (file naming, per-app overrides):

Glob Rule Exceptions
apps/web/src/**/\*.tsx PASCAL_CASE main.tsx excluded
apps/web/src/**/_.ts CAMEL_CASE _.d.ts excluded
apps/api/src/\*_/_.ts KEBAB_CASE ignoreMiddleExtensions for .routes.ts, .test.ts etc.

---

Root .eslintrc.json — now only contains universal rules: TypeScript, naming conventions, imports sorting, and general quality rules. All web/api-specific overrides removed.

apps/web/.eslintrc.json — web zones + filename conventions (PascalCase .tsx, camelCase .ts) + react-hooks/react-refresh overrides. ESLint cascades up and merges with the root automatically.

## apps/api/.eslintrc.json — api zones for all 9 features (accounts, auth, categories, dashboards, imports, investments, tags, transactions, transfers) with the same isolation pattern as web, plus a shared-modules-cannot-import-features zone, and the kebab-case filename override.

Service files (all DB/Drizzle logic lives here now):

accounts.services.ts — listAccounts, createAccount, getAccountById
tags.service.ts — listTags, createTag, deleteTag
categories.service.ts — getCategoryTree
transactions.service.ts — listTransactions, patchTransaction, createManualTransaction, addTagToTransaction, removeTagFromTransaction
Route files (validate → call service → respond, no DB/schema imports):

accounts.routes.ts
tags.routes.ts
categories.routes.ts
transactions.routes.ts
transactions-mutation.routes.ts
A few design notes:

deleteTag returns boolean — route maps false → 404
patchTransaction / createManualTransaction return null for not-found — route maps null → 404
addTagToTransaction returns a discriminated string ('ok' | 'transaction_not_found' | 'tag_not_found') since the route needs to distinguish which resource was missing

---

REFRESH_COOKIE_PATH constant added in auth.routes.ts:16; both getRefreshCookieOptions() and clearCookie now reference it — no more duplicated string literal.
Service shape consistency — registerUser in auth.service.ts:44 now returns the projected { id, email } shape, matching loginUser. The register handler in auth.routes.ts:36 passes user through directly.

---

New files

lib/domain-error.ts — Abstract base class with code: string and httpStatus: number. Services throw subclasses; they never see HTTP status codes. Any future feature creates its own subclass.

features/auth/auth.errors.ts — AuthErrorCode const-enum and AuthError extends DomainError. The HTTP_STATUS and MESSAGES maps are co-located with the error definitions — the right place for that knowledge. The service just does throw new AuthError(AuthErrorCode.EMAIL_TAKEN).

Edited files

db/index.ts — Exports DbTransaction derived via Parameters<Parameters<typeof db.transaction>[0]>[0]. Callers get the correct Drizzle transaction type without importing Drizzle internals.

middleware/error-handler.ts — Added a DomainError branch before the AppError fallback. Responds with { error, code } so clients can match on stable code strings (e.g., AUTH_EMAIL_TAKEN) rather than message text. The code field is a forward-compatibility gift to the web app.

features/auth/auth.service.ts — Three changes:

All createError calls replaced with new AuthError(AuthErrorCode.\*).
loginUser and refreshAccessToken selects scoped to only the columns actually used.
refreshAccessToken token rotation wrapped in db.transaction(), with the delete and the new insert inside the same transaction. issueTokenPair accepts an optional tx parameter (defaults to db) so it can participate in the caller's transaction without being rewritten.

---

Three additions were made:

1. widgets added to web/feature-boundaries — widgets are reusable UI that sit below features in the dependency hierarchy; they were missing from the shared-layer restriction.

2. monorepo/cross-app-isolation — enforces the dependency arrow apps/web → @finance/shared ← apps/api:

apps/web cannot import from apps/api
apps/api cannot import from apps/web
packages/shared cannot import from either app (it's a leaf) 3. api/layer-ordering — applied only to _.services.ts files, prevents them from importing _.routes.ts files, enforcing the one-way flow: routes → services → db.

---

Done. Key changes:

envSchema — single Zod schema declares all vars with types, coercion, and defaults
safeParse + formatted error — reports all invalid/missing vars at once instead of failing on the first one; useful when debugging a new ECS deployment
superRefine — AI key cross-validation runs in the same parse pass
z.coerce.number() — PORT, AI_CONFIDENCE_THRESHOLD, and TRANSFER_DETECTION_WINDOW_DAYS now throw with a clear message on non-numeric input instead of silently producing NaN
optionalEnv/requireEnv helpers removed — Zod replaces them entirely
config object shape is unchanged — no other files need updating

---

Expiry constant — Added REFRESH_TOKEN_EXPIRY = '7d' and used it in signRefreshToken instead of the hardcoded string literal. Both expiry values now derive from the same named constants.

jti in type — Added jti?: string to JwtPayload in shared/src/types/auth.ts. Optional because access tokens don't carry it. Also tightened the signAccessToken/signRefreshToken payload parameter type to Omit<..., 'jti'> so callers can't accidentally pass one in.

Dead code removed — generateRefreshTokenValue and its exclusive use of randomBytes import is gone. (randomBytes is still used by signRefreshToken.)

Safe verify casts — Replaced as JwtPayload with an assertObjectPayload assertion guard that throws if jwt.verify somehow returns a string, replacing a silent type lie with an explicit runtime check.

## Import order — Also tidied imports to node built-ins → third-party → local, per convention.

Scoped select() — only fetches the 6 columns actually used
Single O(n) pass — builds the subcategoryMap and topLevel array in one loop instead of three filter passes
Two-level assumption — still intentionally two levels (matches product design), but now any deeper nodes are simply not present in the map rather than being silently dropped by a filter chain

---

New test file categories.routes.test.ts: 5 tests covering 401 auth, system categories returned, user-specific categories included, subcategory nesting, and user isolation.
All 7 other test files: added categories to schema imports and await db.delete(categories).where(isNotNull(categories.userId)) before db.delete(users) — necessary because categories.userId has an FK to users.id with no cascade, so user-specific categories must be cleaned up first. The existing FK cleanup order in memory was missing this step.

---

test-helpers.ts — added three exports:

cleanDatabase() — the single source of truth for FK-ordered teardown
RegisterResult interface — full register response including user.id
registerUser() — like registerAndLogin but returns the full result
All 8 route test files — each beforeEach is now beforeEach(() => cleanDatabase()) (or await cleanDatabase() inside questrade's compound setup). The schema table imports, db, and isNotNull are gone from every file that had them only for cleanup — cibc, td, and questrade retain only the tables their test bodies actually query.

---

/pipeline/util
amount.toFixed(2) in buildCompositeKey — deterministic float representation
RegExp(/.../) → /.../.exec() — removed redundant wrapper
Month guard in parseDate — throws on unknown abbreviation instead of silently producing "undefined"
NaN guard in parseAmount — throws on non-numeric input instead of silently returning NaN

---

Changes Summary
Deleted
questrade-fixture.xlsx — xlsx fixture no longer needed
questrade-fixture.ts — programmatic xlsx generator removed
xlsx npm package removed from apps/api
New files
questrade.csv — 20-row CSV fixture replacing the xlsx
debit-credit.adapter.ts — abstract base class extracting shared validate() and parse() logic from CIBC and TD
Fixtures (all replaced with anonymized Jan–Feb 2026 data)
amex.csv — 16 rows; date format changed from DD-Mon-YY to DD Mon YYYY; real merchants anonymized
cibc.csv — 15 rows; card number changed; merchants anonymized; includes quoted descriptions with commas
td.csv — 15 rows; all values quoted; descriptions anonymized
Pipeline
utils.ts — parseDate gains a new DD Mon YYYY branch (e.g. 15 Feb 2026); months map moved before both Amex branches to be shared
parser.ts — parseXlsx and xlsx import removed; CSV-only
import.service.ts — fileType parameter removed; always calls parseCsv
registry.ts — comment updated (Questrade no longer xlsx)
Adapters
questrade.adapter.ts — fileType changed to 'csv'; action-required validation removed; empty rawAction now falls back to activityType column ('Dividends' → 'dividend', 'Deposits' → 'deposit')
cibc.adapter.ts — now extends DebitCreditAdapter; detect bug fixed (was matching all 5-column rows; now requires \*\*\*\* in col[4])
td.adapter.ts — now extends DebitCreditAdapter
Routes
imports.routes.ts — xlsx MIME types and .xlsx extension removed from multer filter; fileType detection removed; processImport call updated
Tests
amex.adapter.test.ts — updated for 16 rows, new dates/amounts
cibc.adapter.test.ts — updated for 15 rows; adds detect bug regression test; verifies quoted-comma descriptions
td.adapter.test.ts — updated for 15 rows; new description assertions (EMPLOYMENT INS DEP, CREDIT CARD PYMT)
questrade.adapter.test.ts — fully rewritten to load CSV fixture; tests all action mappings including empty-action fallback and all three account types
imports.routes.test.ts — counts updated 3→16
cibc-import.routes.test.ts — counts updated 4→15
td-import.routes.test.ts — counts updated 5→15; assertions updated for new descriptions
questrade-import.routes.test.ts — fully rewritten; uses CSV file upload; counts updated 3→20; adds empty-action fallback test

---

imports.errors.ts

Added EMPTY_FILE error code with 422 status and message 'The uploaded file contains no rows'
rules-engine.ts

Extracted loadRules(userId) — the DB fetch, exported for batch callers
Extracted applyRules(description, rules) — pure matching function, no DB access
runRulesEngine kept as a convenience wrapper (fetch + apply) for any single-transaction callers
pipeline.ts

categorize() gains an optional rules?: Rule[] parameter
When rules is provided, calls applyRules directly (no DB round-trip); when absent, fetches via loadRules — backwards-compatible for any future callers that don't pass rules
Re-exports loadRules and Rule so import.service has a single import path
import.service.ts

Issue 1: Raw DB error messages replaced with a sanitized generic string; full error logged server-side
Issue 2: loadRules(userId) called once before the loop; passed through to processTransactionRow → categorize
Issue 3: Row loop + detectTransfers + final status update wrapped in try/catch; the catch sets import status to 'error' before re-throwing
Issue 4: Both transactions and investmentTransactions inserts now use .onConflictDoNothing().returning() — duplicate detected by checking if inserted is undefined
Issue 5: Comment added explaining the result.rowCount overwrite
Issue 7: TODO comment added on the S3 key
Issue 8: Empty file guard added immediately after parseCsv, before adapter detection
transfer-detection.service.ts

## Issue 6: Both sql.raw(ARRAY[...]) patterns replaced with inArray() from drizzle-orm

The final state of the three files:

tags.errors.ts — new file, mirrors the auth error pattern with TAG_NOT_FOUND (404) and TAG_NAME_TAKEN (409).

tags.service.ts:

listTags — scoped to TAG_COLUMNS (id, name, color, createdAt), no more select \*
createTag — pre-checks for duplicate name, throws TagError(NAME_TAKEN) if found; .returning() now uses TAG_COLUMNS too
deleteTag — collapsed to a single atomic DELETE ... WHERE (id AND userId) RETURNING; returns { id } | null instead of boolean
tags.routes.ts — delete handler now throws TagError(NOT_FOUND) on null, letting the global error handler format the 404 consistently instead of the inline res.status(404).json(...).
