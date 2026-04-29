# Database Seeding

Reference for `apps/api/src/db/` seed files — what each one does, and how to use them when setting up or maintaining the production RDS database.

## File Reference

### Connection & Schema

| File | Purpose |
|------|---------|
| `src/db/index.ts` | Lazy DB connection pool. Automatically applies SSL for non-localhost connections — RDS works via `DATABASE_URL` with no extra config. |
| `src/db/schema.ts` | Drizzle table definitions. Source of truth for the DB structure. |
| `src/db/migrations/` | Auto-generated SQL migration files. Never edit manually. |

---

### Static Seed Data

| File | Purpose |
|------|---------|
| `src/db/seeds/categories.ts` | The raw `SYSTEM_CATEGORIES` array — 19 top-level categories (Food, Transport, Housing, Salary, etc.) with their subcategories. Data source only, not a runnable script. |
| `src/db/seeds/rules.ts` | The raw `RULES` array — keyword → category mappings (e.g. `"tfr-to"` → Transfer/Credit Card Payment). Data source only, not a runnable script. |

---

### Seed Functions (library, not scripts)

`src/db/seed-categories.ts` exports three functions used by all other seeds and by the user registration flow:

| Function | What it does |
|----------|-------------|
| `seedSystemCategories()` | Upserts the system category tree (`userId = null`) from `SYSTEM_CATEGORIES`. Idempotent — skips existing rows. |
| `seedUserCategories(userId, tx)` | Copies the system category tree to a specific user with new IDs. Called during user registration inside the signup transaction. |
| `seedUserRules(userId, tx)` | Copies system rules to a specific user, remapping category FK references to the user's own category copies. Called after `seedUserCategories`. |

---

### Runnable Scripts

| File | pnpm command | What it does | Use for |
|------|-------------|-------------|---------|
| `src/db/seed-system.ts` | `pnpm seed:system` | Seeds system categories → inserts system rules from `RULES` array (skips dupes) → backfills rules for any users who don't have them | **Production: initial setup and rule backfill** |
| `src/db/seed.ts` | *(no pnpm script — run directly)* | Seeds system categories → backfills categories for users who don't have them → backfills rules for users who don't have them | **Production: category + rule backfill for existing users** |
| `src/db/seed-dev.ts` | `pnpm seed:dev` | Creates `dev@example.com`, 4 accounts, imports CSV fixtures, seeds anticipated budget and rebalancing groups | **Local dev only — never run against RDS** |
| `src/db/seed-test.ts` | `pnpm --filter api db:seed:test` | Runs `seed.ts` pointed at `DATABASE_URL_TEST` | **Test DB only** |

---

## Production Setup

### Fresh RDS (first deploy)

```bash
# 1. Run all migrations to create tables
DATABASE_URL=<rds-url> pnpm db:migrate

# 2. Seed system categories and system rules
# (reads DATABASE_URL from apps/api/.env)
pnpm seed:system
```

After this, new user registrations automatically call `seedUserCategories` and `seedUserRules` inside the signup transaction — no manual step needed per user.

---

### Backfilling existing users

Use this if users were registered before per-user category/rule seeding was added, or after a new system category or rule is introduced.

`seed-system.ts` (`pnpm seed:system`) backfills **rules** for users missing them but does not backfill **categories**. If users are missing both, run `seed.ts` directly from `apps/api`:

```bash
cd apps/api
DATABASE_URL=<rds-url> tsx src/db/seed.ts
```

This will:
- Re-upsert system categories (idempotent)
- Find every user without category rows and copy the system tree to them
- Find every user without rule rows and copy system rules to them

Both operations are safe to re-run — existing rows are detected and skipped.
