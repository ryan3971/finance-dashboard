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
| `staging` | `db/seeds/staging/` | Staging/dev set — categories, rules, accounts, anticipated budget, rebalancing groups, CSV fixtures |
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

### `pnpm seed:dev`

Bootstraps `finance_dev` with staging sample data. Idempotent — safe to re-run.

```
1. addSystemCategories('staging')
2. addSystemRules('staging')
3. Ensure dev user (dev@example.com / password123)
4. seedSampleAccounts + seedSampleTransactions
5. seedSampleAnticipatedBudget
6. seedSampleRebalancingGroups
```

### `pnpm seed:staging`

Same flow as `seed:dev` but targets the staging database.

### `pnpm seed:production`

System data only — no users, no sample data.

```
1. addSystemCategories('system')
2. addSystemRules('system')
3. backfillCategoriesToAllUsers()
4. backfillRulesToAllUsers()
```

### `pnpm seed:system --env=<env>`

Add system categories and rules for a specific environment.

```bash
pnpm seed:system --env=system   # production data set
pnpm seed:system --env=staging  # staging data set
pnpm seed:system --env=test     # test data set
```

### `pnpm remove:system --env=<env>`

Remove all system (userId=null) rules then categories. The `--env` flag is accepted
for symmetry but not used — all system rows are removed regardless of which set
was used to seed them.

### `pnpm seed:user --userId=<uuid> [--env=staging|test]`

Seed a full fixture data set into an existing user's account. The user must have
no accounts yet. Defaults to `--env=staging`.

### `pnpm backfill:categories` / `pnpm backfill:rules`

Find users who have no per-user category/rule copies and seed them. Run after
updating the system data set in production.

---

## `seed/seed.service.ts` — HTTP endpoint

`POST /api/v1/seed/load` calls `loadSampleData(userId)`, which:

1. Checks the user has no accounts (throws `SeedError.ACCOUNTS_EXIST` if they do)
2. Calls the four sample seeders with `env = 'staging'`
3. On any error — compensating delete of all the user's accounts (FK cascades clean up the rest)

This endpoint is the mechanism for users to self-serve staging data from the UI.

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

---

## File map (before → after)

| Removed | Replaced by |
|---------|-------------|
| `db/seed-categories.ts` | `db/seeders/system-categories.ts` + `db/seeders/user-categories.ts` |
| `db/seed-rules.ts` | `db/seeders/system-rules.ts` + `db/seeders/user-rules.ts` |
| `db/seed-system.ts` | `db/seeders/system-categories.ts` + `db/seeders/system-rules.ts` |
| `db/seed.ts` | `scripts/` entry points + `db/seeders/backfill-*.ts` |
| `db/seed-dev.ts` | `scripts/dev.ts` |
| `db/seed-user.ts` | `scripts/seed-user.ts` |
| `db/seed-test.ts` | Vitest setup handles test DB bootstrap |
| `db/seed-test-system.ts` | `testing/seeders/reset-test-system-data.ts` (unchanged) |
| `db/copy-user-data.ts` | `db/seeders/user-categories.ts` + `db/seeders/user-rules.ts` |
| `db/staging/seed-system-data.ts` | `db/seeders/system-categories.ts` + `db/seeders/system-rules.ts` |
| `db/staging/seed-anticipated-budget.ts` | `db/seeders/sample-anticipated-budget.ts` |
| `db/staging/seed-rebalancing-groups.ts` | `db/seeders/sample-rebalancing-groups.ts` |
| `db/staging/clear-system-data.ts` | `removeSystemCategories` / `removeSystemRules` |
| `db/staging/data/` | `db/seeds/staging/` |
| `db/dev/seed.ts` | `scripts/dev.ts` |
