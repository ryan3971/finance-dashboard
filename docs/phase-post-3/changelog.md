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

testing/setup.ts — sets process.env.BCRYPT_ROUNDS = '4' before any test module loads; reduces per-test hashing from ~300 ms to ~5 ms with no change to production behaviour

