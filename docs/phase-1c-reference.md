# Phase 1C Reference

Rules Seed · Categories API · Auth UI · Integration Tests · Phase 2 Scaffolding

---

## Completed — Acceptance Criteria

All 16 acceptance criteria from the spec were met.

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `scripts/seed-rules.ts` exists and is runnable via `pnpm seed:rules` | ✓ |
| 2 | Running the seed inserts rules; subsequent Amex import produces fewer `Uncategorized` results | ✓ |
| 3 | `GET /api/v1/categories` returns full nested category tree; auth required | ✓ |
| 4 | Web app has a `/login` page with email + password form | ✓ |
| 5 | Web app has a `/register` page with email + password form | ✓ |
| 6 | Successful login stores the access token and redirects to `/` | ✓ |
| 7 | Successful register stores the access token and redirects to `/` | ✓ |
| 8 | Unauthenticated user visiting `/` is redirected to `/login` | ✓ |
| 9 | `VITE_ACCESS_TOKEN` shim removed — auth flows through login form | ✓ |
| 10 | `POST /api/v1/auth/logout` called on sign-out; redirects to `/login` | ✓ |
| 11 | CIBC import integration test passes end-to-end | ✓ |
| 12 | TD import integration test passes end-to-end | ✓ |
| 13 | `start_date` and `end_date` filter tests pass | ✓ |
| 14 | `category_id` filter test passes | ✓ |
| 15 | `pnpm typecheck` passes with zero errors | ✓ |
| 16 | `pnpm test` passes — 54 tests (was 45) | ✓ |

---

## What Was Built

| # | Piece | Location |
|---|-------|----------|
| 1 | Rules seed script | `scripts/seed-rules.ts` |
| 2 | `seed:rules` npm script | root `package.json` |
| 3 | Categories API route | `apps/api/src/routes/categories.routes.ts` |
| 4 | Categories route registered | `apps/api/src/app.ts` |
| 5 | Axios API instance | `apps/web/src/lib/api.ts` |
| 6 | `useTransactions` hook | `apps/web/src/hooks/useTransactions.ts` |
| 7 | `useCategories` hook | `apps/web/src/hooks/useCategories.ts` |
| 8 | Auth context | `apps/web/src/contexts/AuthContext.tsx` |
| 9 | Protected route guard | `apps/web/src/components/ProtectedRoute.tsx` |
| 10 | Login page | `apps/web/src/pages/LoginPage.tsx` |
| 11 | Register page | `apps/web/src/pages/RegisterPage.tsx` |
| 12 | Transactions page | `apps/web/src/pages/TransactionsPage.tsx` |
| 13 | App router | `apps/web/src/App.tsx` (replaced) |
| 14 | VITE_ACCESS_TOKEN removed | `apps/web/.env.local` (deleted) |
| 15 | CIBC integration tests | `apps/api/src/routes/cibc-import.routes.test.ts` |
| 16 | TD integration tests | `apps/api/src/routes/td-import.routes.test.ts` |
| 17 | Date + category filter tests | `apps/api/src/routes/transactions.routes.test.ts` (appended) |
| 18 | Phase 2 directory scaffolding | `apps/web/src/dashboards/{snapshot,income,expenses,investments}/`, `apps/web/src/widgets/` |

**Final state:** 54/54 tests pass · `pnpm typecheck` zero errors across all packages.

---

## Deviations from Spec

### 1. `apps/web/src/lib/api.ts` did not exist
The spec assumed this file already existed and just needed the `VITE_ACCESS_TOKEN` line removed. In reality it did not exist at all — the Phase 1B web app made all API calls inline in `App.tsx` using bare axios. The file was created from scratch with an axios instance and the `localStorage` request interceptor.

### 2. `useTransactions` hook was not mentioned in the spec
`TransactionsPage` (which the spec provided in full) imports `useTransactions`, but the hook was never mentioned in the spec's file list. It was created as an undocumented dependency.

### 3. Filter tests placed in `transactions.routes.test.ts`, not `imports.routes.test.ts`
The spec instructed adding the `start_date`/`end_date`/`category_id` filter tests to `imports.routes.test.ts`. They were placed in `transactions.routes.test.ts` instead — where `account_id`, `flagged`, and pagination filters already live. The transactions file is the correct home for tests against `GET /api/v1/transactions`.

### 4. Two existing test files required FK cleanup fix
`imports.routes.test.ts` and `transactions.routes.test.ts` both had a pre-existing gap in their `beforeEach` cleanup: they deleted `transactions` and `imports` but not `investmentTransactions`. This worked until Phase 1C, because no prior tests created `investment_transactions` rows. The new TD import tests do. When TD tests ran first, leftover `investment_transactions` rows caused FK violations when subsequent `beforeEach` calls tried to `DELETE FROM imports`.

Both files were updated to add `await db.delete(investmentTransactions)` between the `transactions` and `imports` deletes — matching the FK-correct order documented in the Phase 1C spec and already used in `accounts.routes.test.ts`.

---

## Decisions Made

### Access token stored in `localStorage` (not in-memory)
`AuthContext` stores the access token in `localStorage` so it survives page reloads. The `api.ts` interceptor already read from there (it was designed this way in Phase 1B even before the auth UI existed). The tradeoff (XSS exposure vs. usability) is acceptable for this app's threat model. If this changes, the interceptor in `api.ts` and `AuthContext`'s `login`/`logout` functions are the only two places to update.

### `VITE_ACCESS_TOKEN` removed, `.env.local` deleted
The file's only entry was `VITE_ACCESS_TOKEN`. Deleting the file entirely is cleaner than leaving an empty file. The Phase 1B reference doc still mentions the variable under "Web app variable" — that section is now obsolete.

### Seed script imports from monorepo root
`scripts/seed-rules.ts` resolves `apps/api/src/db/index` and `apps/api/src/db/schema` relative to the repo root. Running `pnpm seed:rules` must be done from the repo root (which is the only place `pnpm` scripts run anyway). The script calls `dotenv.config({ path: path.resolve(process.cwd(), '.env') })` to load secrets from the root `.env`.

### Category `icon` field is nullable in the API response
The spec's `useCategories` hook and categories route both expose `icon: string | null`. The schema column is `text` (nullable). No icons are seeded — every category returns `icon: null` until a future session populates them.

---

## Blockers / Issues Encountered

### FK constraint crash after adding TD/CIBC tests
**Symptom:** `imports.routes.test.ts` and `transactions.routes.test.ts` went from passing to failing with:

```
update or delete on table "imports" violates foreign key constraint
"investment_transactions_import_id_imports_id_fk" on table "investment_transactions"
```

**Root cause:** The TD adapter creates `investment_transactions` rows (for the Questrade transfer row in the TD fixture). Since `vitest.config.ts` has `fileParallelism: false`, test files run sequentially. When the TD test file ran before the others, it left `investment_transactions` rows in the DB. The next file's `beforeEach` then tried to `DELETE FROM imports` without first deleting `investment_transactions`, violating the FK.

**Fix:** Added `await db.delete(investmentTransactions)` to `beforeEach` in both affected files.

---

## Exact Versions Installed

### New in Phase 1C

| Package | Version | Where |
|---------|---------|-------|
| `tsx` | `4.21.0` | root `devDependencies` |

### Pre-existing (confirmed exact versions)

| Package | Version | Where |
|---------|---------|-------|
| `react` | `18.3.1` | `apps/web` |
| `react-dom` | `18.3.1` | `apps/web` |
| `react-router-dom` | `6.30.3` | `apps/web` |
| `@tanstack/react-query` | `5.95.2` | `apps/web` |
| `axios` | `1.13.6` | `apps/web` |
| `express` | `4.22.1` | `apps/api` |
| `drizzle-orm` | `0.30.10` | `apps/api` |
| `vitest` | `1.6.1` | `apps/api` |
| `typescript` | `5.9.3` | root |

---

## Next Session Prerequisites

### Environment (must be running)
```bash
# Postgres on host port 5434
docker compose up -d postgres

# Verify migrations are current
pnpm --filter api db:migrate

# Seed system categories (if fresh DB)
pnpm --filter api db:seed

# Seed categorization rules (new in Phase 1C — run once per DB)
pnpm seed:rules
```

### Verify clean state before starting Phase 2
```bash
pnpm install          # should be a no-op
pnpm typecheck        # expect: zero errors
pnpm --filter api test  # expect: 54 passed
```

### Phase 2 context
Phase 1 is complete. The app now supports full register → login → import → view-transactions flow without any manual terminal steps.

Phase 2 directories are pre-created and empty:

```
apps/web/src/
├── dashboards/
│   ├── snapshot/     # Monthly snapshot dashboard
│   ├── income/       # Income breakdown dashboard
│   ├── expenses/     # Expense breakdown dashboard
│   └── investments/  # Investment portfolio dashboard
└── widgets/          # Shared chart/card components
```

### What Phase 2 will need from this session's work
- `useCategories` hook — ready for filter dropdowns
- `GET /api/v1/categories` endpoint — ready for any dashboard that needs category data
- `AuthContext` / `useAuth` — ready for any new page; just wrap with `<ProtectedRoute>`
- `api.ts` instance — use this for all new API calls; do not add new inline axios calls

### Useful commands for the next session
```bash
# Inspect seeded rules
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d finance_dev \
  -c "SELECT keyword, source_name, need_want, priority FROM categorization_rules WHERE user_id IS NULL ORDER BY priority DESC, keyword LIMIT 20;"

# Test the categories endpoint (replace <TOKEN> with a fresh token)
curl -s http://localhost:3001/api/v1/categories \
  -H "Authorization: Bearer <TOKEN>" | jq '[.[] | {name, subs: (.subcategories | length)}]'

# Count rules by category
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d finance_dev \
  -c "SELECT c.name, COUNT(r.id) AS rules FROM categorization_rules r LEFT JOIN categories c ON c.id = r.category_id WHERE r.user_id IS NULL GROUP BY c.name ORDER BY rules DESC;"
```