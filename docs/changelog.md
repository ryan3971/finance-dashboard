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