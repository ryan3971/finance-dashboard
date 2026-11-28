# Seeding Layer

## Overview

The seeding layer is split into three directories:

| Directory | Purpose |
|-----------|---------|
| `db/seeds/<env>/` | Pure data constants — no logic, no DB access |
| `db/seeders/` | Pure functions that write seed data to the DB |
| `scripts/` | Thin CLI entry points — parse args, call seeders, exit |

---

## Data sets (`db/seeds/`)

Three environments, three data sets:

| Env | Path | Contents |
|-----|------|----------|
| `system` | `db/seeds/system/` | Full production set — 92 categories, 60+ rules |
| `staging` | `db/seeds/staging/` | Staging set — categories, rules, accounts, transactions, anticipated budget, rebalancing groups, tags, user config, investment transactions, contribution records, CSV fixtures |
| `test` | `db/seeds/test/` | Minimal frozen set — shared source of truth for tests and local dev |

CSV fixtures for staging live at `db/seeds/staging/csv/`. Test CSVs stay at `testing/csv/`.

---

## Seeders (`db/seeders/`)

Each file exports one or two clearly named functions. No CLI logic, no `process.exit`.

### System data

```ts
// db/seeders/system-categories.ts
addSystemCategories(env: SeedEnv, db?)  // idempotent upsert
removeSystemCategories(db?)             // deletes all userId=null category rows

// db/seeders/system-rules.ts
addSystemRules(env: SeedEnv, db?)       // idempotent upsert
removeSystemRules(db?)                  // deletes all userId=null rule rows
```

`SeedEnv = 'system' | 'staging' | 'test'` — controls which data set is loaded.

Always call `removeSystemRules` before `removeSystemCategories` (rules hold FKs into categories).

### Per-user data (called at registration)

```ts
// db/seeders/user-categories.ts
seedUserCategories(userId, tx)  // copies system category tree to user

// db/seeders/user-rules.ts
seedUserRules(userId, tx)       // copies system rules to user, remapping category IDs
```

Both accept `typeof db | DbTransaction` so they can participate in the registration transaction.

### Backfill

```ts
// db/seeders/backfill-categories.ts
backfillCategoriesToAllUsers(db?)  // seeds categories for any user who has none

// db/seeders/backfill-rules.ts
backfillRulesToAllUsers(db?)       // seeds rules for any user who has none
```

Run after `addSystemCategories` / `addSystemRules` so the system rows exist to copy from.

### Sample data (staging/dev HTTP endpoint)

```ts
// db/seeders/sample-accounts.ts
seedSampleAccounts(userId, env, db?)
  → Record<string, string>  // name → account ID

// db/seeders/sample-transactions.ts
seedSampleTransactions(userId, env, accountIds, db?)
  // imports CSV fixtures; skips files that don't exist

// db/seeders/sample-anticipated-budget.ts
seedSampleAnticipatedBudget(userId, env, db?)
  → Map<string, string>  // entry name → ID

clearSampleAnticipatedBudget(userId, db?)

// db/seeders/sample-rebalancing-groups.ts
seedSampleRebalancingGroups(userId, env, db?)
clearSampleRebalancingGroups(userId, db?)
```

CSV path is resolved inside the seeder based on `env`:
- `'staging'` → `db/seeds/staging/csv/<file>`
- `'test'` → `testing/csv/<file>`

---

## CLI scripts (`scripts/`)

Only `seed:dev` has a root alias; run the others with `pnpm --filter api <script>`.

### `pnpm seed:dev`

Bootstraps `finance_dev` with the `test` data set. Idempotent — safe to re-run.

```
1. addSystemCategories('test')
2. addSystemRules('test')
3. Ensure dev user (dev@example.com / password123)
4. seedSampleAccounts + seedSampleTransactions
5. seedSampleAnticipatedBudget
6. seedSampleRebalancingGroups
```

### `pnpm --filter api seed:staging`

Same flow as `seed:dev`, but with the `staging` data set and against the staging database.

### `pnpm --filter api seed:production`

System data only — no users, no sample data.

```
1. addSystemCategories('system')
2. addSystemRules('system')
3. backfillCategoriesToAllUsers()
4. backfillRulesToAllUsers()
```

### `pnpm --filter api seed:system --env=<env>`

Add system categories and rules for a specific environment.

```bash
pnpm --filter api seed:system --env=system   # production data set
pnpm --filter api seed:system --env=staging  # staging data set
pnpm --filter api seed:system --env=test     # test data set
```

There is no CLI script for removal; `removeSystemRules` / `removeSystemCategories` are called from
code only.

### `pnpm --filter api seed:user --userId=<uuid> [--env=staging|test]`

Seed a full fixture data set into an existing user's account. The user must have
no accounts yet. Defaults to `--env=staging`.

### `pnpm --filter api backfill:categories` / `pnpm --filter api backfill:rules`

Find users who have no per-user category/rule copies and seed them. Run after
updating the system data set in production.

---

## HTTP endpoints

### `POST /api/v1/seed/load` — Load sample data

Calls `loadSampleData(userId)` in `features/seed/seed.service.ts`, which reads the `staging` data
set directly (it does not use the `db/seeders/` sample seeders):

1. Checks the user has no accounts (throws `SeedError.ACCOUNTS_EXIST` → 409 if they do)
2. Inserts the staging categories and rules as user-level rows, outside the main transaction and
   idempotently, so they are committed before the rules are loaded and a retry is safe
3. In **one DB transaction**: accounts, transactions (categorized with the loaded rules),
   anticipated budget entries, rebalancing groups, user config, tags, investment transactions, and
   contribution records. Any error rolls the whole load back — there is no compensating delete.
4. After that transaction commits, runs `detectTransfers` on the inserted transactions
   (`detectTransfers` opens its own transaction, so it can't be nested inside the load).

### `POST /api/v1/user-config/reset` — Reset account

Calls `deleteAllUserData(userId)` in a single transaction, then re-seeds default categories and rules and inserts a fresh `userConfig` row. The user remains authenticated — no token invalidation.

Deletion order (required by foreign key constraints):

1. `transactions` (via account IDs — no direct `userId` column)
2. `investmentTransactions` (via account IDs)
3. `contributionRecords` (via account IDs)
4. `imports`
5. `accounts`
6. `categorizationRules`
7. `categories` (user-owned rows only — `userId IS NOT NULL`)
8. `tags`
9. `anticipatedBudgetMonths` (via budget IDs — no direct `userId` column)
10. `anticipatedBudget`
11. `userConfig`
12. `rebalancingGroups` (`rebalancingGroupTransactions` cascades automatically)

Every delete is scoped to the calling user's ID. Tables without a direct `userId` column (`transactions`, `investmentTransactions`, `contributionRecords`, `anticipatedBudgetMonths`) require a preliminary select to collect the relevant parent IDs before the scoped `inArray` delete.

---

## Registration flow

`features/auth/auth.service.ts` and `features/user-config/user-config.service.ts`
both call the per-user seeders inside the registration transaction:

```ts
await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values(...).returning(...);
  await seedUserCategories(user.id, tx);
  await seedUserRules(user.id, tx);
});
```

The transaction guarantees atomicity — a failed seed rolls back the user insert entirely.

---

## Adding a new environment data set

1. Create `db/seeds/<env>/categories.ts`, `rules.ts`, and any other files needed.
2. Add the new env to the `SeedEnv` union in `db/seeders/system-categories.ts`.
3. Add a branch in each seeder's data-resolution function (`getCategoriesData`, etc.).
4. Add a script entry point in `scripts/` if needed.

