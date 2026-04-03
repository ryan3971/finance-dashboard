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
Updated (7 files) — all local registerAndLogin/createAccount duplicates removed, replaced with imports from the helper. Inline res.body.* accesses cast through the appropriate typed interface:

transactions.routes.test.ts — PaginatedResponse<T> casts per assertion
imports.routes.test.ts — ImportSummaryResponse + PaginatedResponse casts; AMEX_ACCOUNT constant to avoid repetition
accounts.routes.test.ts — AccountResponse casts
cibc-import.routes.test.ts — ImportSummaryResponse casts; CIBC_ACCOUNT constant
td-import.routes.test.ts — ImportSummaryResponse casts; TD_ACCOUNT constant
questrade-import.routes.test.ts — ImportSummaryResponse casts; beforeEach now uses the shared helpers
auth.routes.test.ts — AuthResponse casts on register/login body access
---
@typescript-eslint/naming-convention (identifier naming, global):

Selector	Allowed formats	Notes
variable	camelCase, PascalCase, UPPER_CASE	React component vars + constants
function	camelCase, PascalCase	Hooks/utils + React components
parameter	camelCase	_prefix allowed for unused
typeLike	PascalCase	interfaces, types, classes, enums
enumMember	UPPER_CASE, PascalCase	
import	camelCase, PascalCase	Named + default imports
objectLiteralProperty / typeProperty	unrestricted	External data shapes (DB/AI/API)
variable + destructured	unrestricted	Destructuring from external data
check-file/filename-naming-convention (file naming, per-app overrides):

Glob	Rule	Exceptions
apps/web/src/**/*.tsx	PASCAL_CASE	main.tsx excluded
apps/web/src/**/*.ts	CAMEL_CASE	*.d.ts excluded
apps/api/src/**/*.ts	KEBAB_CASE	ignoreMiddleExtensions for .routes.ts, .test.ts etc.
---
Root .eslintrc.json — now only contains universal rules: TypeScript, naming conventions, imports sorting, and general quality rules. All web/api-specific overrides removed.

apps/web/.eslintrc.json — web zones + filename conventions (PascalCase .tsx, camelCase .ts) + react-hooks/react-refresh overrides. ESLint cascades up and merges with the root automatically.

apps/api/.eslintrc.json — api zones for all 9 features (accounts, auth, categories, dashboards, imports, investments, tags, transactions, transfers) with the same isolation pattern as web, plus a shared-modules-cannot-import-features zone, and the kebab-case filename override.
---
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

All createError calls replaced with new AuthError(AuthErrorCode.*).
loginUser and refreshAccessToken selects scoped to only the columns actually used.
refreshAccessToken token rotation wrapped in db.transaction(), with the delete and the new insert inside the same transaction. issueTokenPair accepts an optional tx parameter (defaults to db) so it can participate in the caller's transaction without being rewritten.
---
Three additions were made:

1. widgets added to web/feature-boundaries — widgets are reusable UI that sit below features in the dependency hierarchy; they were missing from the shared-layer restriction.

2. monorepo/cross-app-isolation — enforces the dependency arrow apps/web → @finance/shared ← apps/api:

apps/web cannot import from apps/api
apps/api cannot import from apps/web
packages/shared cannot import from either app (it's a leaf)
3. api/layer-ordering — applied only to *.services.ts files, prevents them from importing *.routes.ts files, enforcing the one-way flow: routes → services → db.
---
Done. Key changes:

envSchema — single Zod schema declares all vars with types, coercion, and defaults
safeParse + formatted error — reports all invalid/missing vars at once instead of failing on the first one; useful when debugging a new ECS deployment
superRefine — AI key cross-validation runs in the same parse pass
z.coerce.number() — PORT, AI_CONFIDENCE_THRESHOLD, and TRANSFER_DETECTION_WINDOW_DAYS now throw with a clear message on non-numeric input instead of silently producing NaN
optionalEnv/requireEnv helpers removed — Zod replaces them entirely
config object shape is unchanged — no other files need updating