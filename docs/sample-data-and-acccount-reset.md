# Sample Data & Account Reset

## Overview

Two companion features that make the app usable as a portfolio demo without
requiring a user to manually import real bank data:

- **Load sample data** — one-click population of realistic accounts, transactions,
  anticipated budget entries, and rebalancing groups from fixture files.
- **Reset account** — full wipe of all user-owned data followed by restoration of
  default categories and rules, returning the account to a clean first-run state.

Together they form a self-contained demo loop: load → explore → reset → repeat.

---

## Feature Spec

### Load Sample Data (`POST /api/v1/seed/load`)

Inserts three fixture accounts (Amex credit, CIBC Mastercard, TD Chequing) and
runs their CSV files through the existing import pipeline, which applies the full
categorization and transfer-detection logic. After accounts and transactions are
in place, anticipated budget entries and rebalancing groups are seeded from the
same fixture data used in integration tests.

Returns `409 Conflict` if the user already has any accounts. This prevents
partial double-loading without requiring a separate pre-flight check on the
client.

**UI entry point:** a "Load sample data" button appears in the NavBar (desktop
and mobile drawer) only when the user has no accounts. It disappears once data is
loaded, removing any ambiguity about whether the action is safe to repeat.

### Reset Account (`POST /api/v1/user-config/reset`)

Deletes all user-owned data in FK-safe order within a single database transaction,
then re-seeds default categories and categorization rules and inserts a fresh
`userConfig` row. The user remains authenticated — no token invalidation.

**UI entry point:** a "Reset account" card in the Preferences tab (`/config`),
behind a confirm dialog. On success the user is redirected to `/dashboard/snapshot`,
which now shows the empty-account state.

**Deletion order** (required by foreign key constraints):

1. `transactions` (via account IDs — no direct `userId` column)
2. `imports`
3. `accounts`
4. `categorizationRules`
5. `categories` (user-owned rows only — `userId IS NOT NULL`)
6. `tags`
7. `anticipatedBudgetMonths` (via budget IDs — no direct `userId` column)
8. `anticipatedBudget`
9. `userConfig`
10. `rebalancingGroups` (`rebalancingGroupTransactions` cascades automatically)

---

## Architecture Notes

### Compensating rollback in `loadSampleData`

The import pipeline (`processImport`) issues its own DB writes using the top-level
`db` instance and cannot join a caller-supplied transaction. This means the entire
load operation cannot be made atomic with a single `db.transaction()` wrapper.

Instead, `loadSampleData` uses a compensating rollback: if any step fails after
accounts have been inserted, a targeted `DELETE FROM accounts WHERE user_id = $1`
is issued. Foreign key cascades propagate the delete to `transactions` and
`imports`, leaving the user in the same state as before the call.

The 409 guard at the top of `loadSampleData` ensures this path is only ever
entered for a user with no prior accounts, so the compensating delete cannot
accidentally remove real user data.

### Scoped deletes in `deleteAllUserData`

Every delete in the reset path is explicitly scoped to the calling user's ID.
This is different from the test utility `cleanDatabase()`, which issues blanket
deletes across all rows. Tables that do not carry a direct `userId` column
(`transactions`, `anticipatedBudgetMonths`) require a preliminary select to
collect the relevant parent IDs before the scoped `inArray` delete.

### `resetTestSystemData` fix (collateral improvement)

Implementing the integration tests exposed a pre-existing gap: `seedTestAnticipatedBudget`
inserts rows referencing system category IDs. If those rows were not cleaned up
before the next test run's `resetTestSystemData()` call, the delete of system
categories would fail with an FK violation. The fix adds explicit deletion of
`anticipatedBudgetMonths` and `anticipatedBudget` before the system category
delete. This is a correctness fix that benefits the entire test suite, not just
the new tests.

---

## Justification for Using Test Fixtures in a Live Route

`seed.service.ts` imports from `apps/api/src/testing/` — specifically
`DEV_ACCOUNTS`, `seedTestAnticipatedBudget`, and `seedTestRebalancingGroups`.
In a production multi-tenant application this would be inappropriate. The
justification for accepting it here:

**1. This is a portfolio demo, not a multi-tenant product.**
The app is deployed for a single user (the portfolio owner). There is no risk of
fixture data leaking between tenants, polluting analytics, or being mistaken for
real production behaviour by other users.

**2. The fixture data is the source of truth for the demo.**
The CSV files, account definitions, budget entries, and rebalancing groups in
`testing/` are the exact records that make the dashboard tabs interesting to
look at. Duplicating them into a separate `seed/fixtures/` tree would create two
copies that would drift. Reusing them directly keeps the demo coherent with
the test baseline.

**3. The `testing/` helpers are pure data functions.**
`seedTestAnticipatedBudget` and `seedTestRebalancingGroups` do nothing
test-framework-specific — they perform plain Drizzle inserts. There is no Vitest
API, no mock, and no assertion logic involved. The naming is the only thing that
marks them as test infrastructure.

**4. The import pipeline is shared and already production-quality.**
Transactions are loaded via `processImport`, which is the same path used in the
real import UI. Categorization rules, transfer detection, and duplicate handling
all apply. The fixture CSVs produce the same result a user would get by importing
those files manually.

**5. A clean separation can be introduced later at low cost.**
If the app ever grows to support multiple users, the fix is mechanical: move the
fixture data constants and seeders into `src/features/seed/fixtures/` and update
the import paths. No logic changes are required.

---

## Files Changed

| File                                                           | Change                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| `apps/api/src/features/seed/seed.errors.ts`                    | New — domain error (409)                                 |
| `apps/api/src/features/seed/seed.service.ts`                   | New — load logic with compensating rollback              |
| `apps/api/src/features/seed/seed.routes.ts`                    | New — `POST /seed/load`                                  |
| `apps/api/src/features/seed/seed.routes.test.ts`               | New — 5 integration tests                                |
| `apps/api/src/features/user-config/user-config.service.ts`     | Added `deleteAllUserData` + `resetAccount`               |
| `apps/api/src/features/user-config/user-config.routes.ts`      | Added `POST /user-config/reset`                          |
| `apps/api/src/features/user-config/user-config.routes.test.ts` | Added 7 reset tests                                      |
| `apps/api/src/testing/seeders/reset-system-data.ts`            | Fixed FK ordering (budget rows before system categories) |
| `apps/api/src/app.ts`                                          | Registered seed router                                   |
| `apps/api/src/db/seed-user.ts`                                 | New — CLI script for manual seeding by user ID           |
| `apps/api/package.json`                                        | Added `seed:user` script                                 |
| `apps/web/src/features/seed/hooks/useSeedLoad.ts`              | New — mutation hook                                      |
| `apps/web/src/features/config/hooks/useResetAccount.ts`        | New — mutation hook                                      |
| `apps/web/src/components/layout/NavBar.tsx`                    | Conditional "Load sample data" button                    |
| `apps/web/src/features/config/components/PreferencesTab.tsx`   | "Reset account" card + confirm dialog                    |
| `apps/web/src/components/common/DeleteConfirmDialog.tsx`       | Added optional `confirmLabel` prop                       |
| `apps/web/src/lib/toastMessages.ts`                            | Added 5 toast constants                                  |
