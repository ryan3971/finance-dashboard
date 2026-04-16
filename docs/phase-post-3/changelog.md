types.ts
Added isActive: boolean and createdAt: string to AccountResponse
Added new PatchAccountRequest interface (partial, no isCredit — matches patchAccountSchema)
accounts.routes.test.ts
accountRequest question: Yes, the usage is correct and intentional. .send() accepts any, so without the wrapper TypeScript would never type-check the literal. The function is the compile-time enforcement surface. Added a comment making this explicit, and added a matching patchAccountRequest wrapper for PATCH tests.

beforeEach question: cleanDatabase() should stay. registerAndGetToken inserts into users, userConfig, and refreshTokens. A scoped db.delete(accounts) would leave those rows behind — the next test registering test@example.com would fail a unique-constraint violation. The minimum correct scope would still require 4 delete statements, and cleanDatabase() is safer if future tests add transactions.

New tests added (32 total, up from 10):

GET /accounts — ?includeInactive=true filtering behavior (one test covering both sides of the flag)
POST /accounts — isCredit auto-derivation from type; invalid type value; body on 400s
GET /accounts/:id — 401 without token; 500 for malformed UUID (with comment documenting the missing idParamsSchema on this route vs. the mutation routes)
PATCH /:id — full coverage: happy path, type→isCredit auto-derivation, empty body 400, malformed UUID 400, unknown 404, cross-user 404, 401
POST /:id/deactivate — full coverage: happy path (isActive: false), malformed 400, unknown 404, cross-user 404, 401
POST /:id/reactivate — full coverage: happy path (isActive: true after deactivate), malformed 400, unknown 404, cross-user 404, 401
Existing tests updated: parallel Promise.all for dual-user registration; toMatchObject with full shape on GET /:id happy path; isActive/createdAt in POST assertion; body checks on all 400 responses; more descriptive test names.

---

auth.routes.test.ts — 9 tests → 20 tests

Added extractRefreshCookie helper to parse the name=value segment from set-cookie headers
Register: user.id assertion, JWT regex on accessToken, email normalisation test, nested beforeEach for the 409 case (removes the inline setup call), missing-field tests for email and password
Login: JWT regex on accessToken, error body assertions on both 401 cases, email case-insensitivity test
New describe('POST /api/v1/auth/refresh'): happy path (new token + rotated cookie), absent cookie → 401, invalid JWT → 401, token replay → 401
New describe('POST /api/v1/auth/logout'): happy path (204 + cookie cleared), no-cookie idempotency, post-logout refresh is rejected
Protected route → requireAuth middleware with a second case for malformed Bearer token; comment explains why an accounts endpoint is used here
auth.service.ts — BCRYPT_ROUNDS now reads process.env.BCRYPT_ROUNDS ?? '12' at module load time, matching the same pattern db/index.ts uses for DATABASE_URL

## testing/setup.ts — sets process.env.BCRYPT_ROUNDS = '4' before any test module loads; reduces per-test hashing from ~300 ms to ~5 ms with no change to production behaviour

apps/api/src/testing/test-helpers.ts
Change What
import \* as path from 'path' Required by uploadAmex fixture path
import { expect } from 'vitest' Used to assert status inside uploadAmex / createTag
PaginatedResponse.pagination.limit Added the missing field
AMEX_MANUAL_FIXTURE + uploadAmex() Moved from the test file; now uses amex_manual.csv; asserts 200 so failures surface immediately with a clear message
createTag() New helper used by tag tests
apps/api/src/features/transactions/transactions.routes.test.ts
Change What
Removed local uploadAmex + path import Replaced by the shared helper
Added UNKNOWN_ID, MALFORMED_ID imports Used throughout mutation and validation tests
setupWithImport() helper Eliminates the 8× repeated registerUser + createAccount + uploadAmex block
getFirstTransaction() + getCategoryId() Local helpers to keep mutation tests readable without setup noise
Merged two describe blocks into one Single GET /api/v1/transactions describe
Fixture counts updated (16→6, 8→3) Match amex_manual.csv (6 rows, ceil(6/2)=3 pages)
Date filters updated 2026-02-12/15 → 2026-03-14 which has exactly 1 charge in the new fixture
category_id → categoryId Fixed the broken query param
Category filter now asserts per-row categoryId No longer passes if the filter is inert
Flagged filter: length > 0 guard added Prevents vacuous pass
body.data[0]! → body.data[0]?. Removes forbidden non-null assertion
New: PATCH /api/v1/transactions/:id 6 tests: 401, categorize+clear flag, set note, create rule, 404 unknown, 404 cross-user, 400 malformed id
New: POST /api/v1/transactions 5 tests: 401, create with fields, isIncome derivation, 400 missing fields, 400 malformed id, 422 cross-user account
New: POST /api/v1/transactions/:id/tags 6 tests: 401, add tag, 404 unknown txn, 404 cross-user txn, 404 unknown tag, 400 malformed id
New: DELETE /api/v1/transactions/:id/tags/:tagId 4 tests: 401, remove tag+204, 404 unknown txn, 400 malformed id

---

Integration Tests: user-config.routes.test.ts
17 tests across 2 endpoints covering:

GET /api/v1/user-config (5 tests)
Auth: 401 for missing and malformed bearer tokens
Happy path: 200 with correct shape — new user config has null percentages and emergencyFundTarget
Idempotency: repeated GETs return the same config row (upsert doesn't create duplicates)
Data isolation: users A and B get separate config rows scoped to their userId
PATCH /api/v1/user-config (12 tests)
Auth: 401 for missing and malformed bearer tokens
Happy path: updates allocations and returns new values (50/30/20 split)
No-op PATCH: empty body returns existing config unchanged (verifying the service's early return)
Persistence: subsequent GET reflects the patched values
Data isolation: patching user A doesn't affect user B's config
Validation (6 cases):
Percentages not summing to 100 → 400
Negative percentage → 400
Percentage > 100 → 400
Non-integer percentage (33.33) → 400
Missing required allocation field → 400
Valid edge case: 100/0/0 split accepted correctly

---

Service (transactions.service.ts) — subcategoryId added to TransactionFilters and filter condition wired up
API route (transactions.routes.ts) — added to schema, destructured, and passed to service
useTransactions — accepts, includes in query key, and passes as axios param
TransactionFilters — subcategoryId in FilterState, onChange correctly routes to subcategoryId vs categoryId based on which type of option was selected
TransactionsPage — reads/writes subcategoryId from search params, passes to useTransactions, and includes in the export API call
router.tsx — was missing subcategoryId in transactionsSearchSchema; just added it

---
Root cause: Expense transactions are stored with negative amounts in the DB (the system convention: amount > 0 = income, amount < 0 = expense). The DB queries were doing SUM(amount) which yielded negative values (e.g. -1500). The component gates rendering on data.annualTotal > 0 — which is never true for negative values — so nothing was shown.
Changes made:

expenses.service.ts:39 — queryMonthlyExpenses: changed SUM(amount) → -SUM(amount) so the monthly buckets receive positive expense values.

expenses.service.ts:117 — queryExpensesByCategory: same negation so category totals are also positive.

expenses.routes.test.ts — Updated all expense transaction fixture amounts from positive to negative (matching the real sign convention), and replaced unsafe res.body.x member accesses with properly typed res.body as ExpensesBody / res.body as CategoriesBody casts.
---
snapshot.repository.ts:59-66 — Replaced the four-branch CASE with a simpler two-branch one. Since amounts already carry their sign, non-credit accounts just sum them directly; credit accounts invert the sign so that a negative charge increases the reported balance (debt) and a positive payment reduces it. The old isIncome-based branching was wrong for two of the four combinations.

snapshot.routes.test.ts:110-113 — Fixed the expense fixture from '1200.00' to '-1200.00' to follow the system convention (amount < 0 = expense). The old positive amount was accidentally cancelling the CASE bug so the test stayed green while hiding the defect.
---
snapshot.repository.ts:122-123 — Changed SUM(${transactions.amount}) to SUM(-${transactions.amount}). Expense amounts are stored as negative values by convention; negating them in the query means the service receives positive totals it can accumulate directly without any sign-flip logic at the service layer.

snapshot.routes.test.ts:215-232 — Fixed the three expense fixtures from '800.00', '300.00', '50.00' to '-800.00', '-300.00', '-50.00'. The test now seeds data the way the real import pipeline does, so it will catch any future regression where the sign-flip is removed.