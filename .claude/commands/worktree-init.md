# Worktree Init

Run these steps at the **start** of every worktree session, before writing any code.

## Variables

```powershell
$worktree = "<absolute path to this worktree>"
$main     = "C:\Users\rbt7r\OneDrive\Documents\VSCode Workspace\Finance Dashbard"
```

Replace `<absolute path to this worktree>` with the actual path before running any command below.

---

## Step 1 — Link node_modules

Worktrees have no `node_modules`. Create directory junctions so pnpm, vitest, tsc, ESLint, and Vite all resolve packages from the main project.

```powershell
cmd /c mklink /J "$worktree\node_modules"                 "$main\node_modules"
cmd /c mklink /J "$worktree\apps\api\node_modules"        "$main\apps\api\node_modules"
cmd /c mklink /J "$worktree\apps\web\node_modules"        "$main\apps\web\node_modules"
cmd /c mklink /J "$worktree\packages\shared\node_modules" "$main\packages\shared\node_modules"
```

Skip if junctions already exist from an earlier run.

With junctions in place, all pnpm commands (`pnpm typecheck`, `pnpm --filter api test`, `pnpm db:generate`, etc.) can be run from the **worktree root** directly — no need to copy files to the main project.

## Step 2 — Copy .env

```powershell
Copy-Item "$main\apps\api\.env" "$worktree\apps\api\.env"
```

Required for tests and migrations to connect to the database. Skip if already present.

## Step 3 — Sync with main

Merge any commits that landed on main after this worktree was branched. This is important because files added to main after branching (new test files, migrations, shared type changes) will be absent from the worktree and cause typecheck failures.

```powershell
Set-Location $worktree
git merge main
```

Resolve any merge conflicts before proceeding. Skip if the worktree is freshly created from the current tip of main.

---

## Generating a Drizzle migration

When a feature requires a schema change, generate the migration from the worktree after linking node_modules:

```bash
cd "$worktree/apps/api"
pnpm db:generate
```

Then apply to both DBs:

```bash
cd $worktree
pnpm db:migrate
pnpm --filter api db:migrate:test
```

**Fallback — if junctions are not set up:**

1. Copy the modified schema to main:
   ```powershell
   Copy-Item "$worktree\apps\api\src\db\schema.ts" "$main\apps\api\src\db\schema.ts"
   ```
2. Generate from main: `cd $main && pnpm --filter api db:generate`
3. Copy the three generated files back to the worktree:
   - `apps/api/src/db/migrations/0NNN_*.sql`
   - `apps/api/src/db/migrations/meta/0NNN_snapshot.json`
   - `apps/api/src/db/migrations/meta/_journal.json`
4. Revert main's schema: `git -C $main checkout -- apps/api/src/db/schema.ts`
5. Apply migrations from main: `pnpm db:migrate && pnpm --filter api db:migrate:test`

---

## Running tests and typecheck

With junctions in place, run everything from the worktree root as normal:

```bash
pnpm typecheck
pnpm --filter api test
pnpm --filter api vitest run src/features/<feature>/<feature>.routes.test.ts
```

**Fallback — if junctions are not set up:** copy the changed source files to main, run from there, then revert with `git checkout --`.
