# Finance Dashboard

## Workspaces

Pnpm monorepo. Read the workspace doc before writing code in it:

- **`apps/api`** — Express 5 REST API. Routes, services, DB queries, migrations, API tests → [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md)
- **`apps/web`** — React 18 SPA (Vite, TanStack Router/Query). Components, routes, hooks, data fetching → [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md)
- **`packages/shared`** — Zod schemas, types, constants consumed by both apps. Conventions below.

## Commands

Root scripts (`dev`, `build`, `typecheck`, `lint`, `test`) and per-workspace scripts are in the
`package.json` files. The invocations worth knowing:

```bash
pnpm --filter api vitest run src/features/accounts/accounts.routes.test.ts  # single test file
pnpm --filter api db:migrate:test   # migrate the TEST db; db:migrate targets dev
pnpm --filter api seed:system       # system categories + rules only (no root alias)
pnpm seed:dev                       # full dev fixture set — finance_dev only
```

## Environment

Each app needs its own `.env`, copied from its `.env.example`. Those files carry the current
variable list and the constraints on each value — read them rather than assuming a default.
`ENABLE_AI_CATEGORIZATION=false` in local dev, to avoid API costs.

## Shared Conventions

### `packages/shared`

Import through sub-paths: `@finance/shared/constants`, `@finance/shared/schemas/<name>`,
`@finance/shared/types/<name>`. A literal value that must agree across both apps belongs in
`packages/shared/src/constants.ts`, defined once.

### Barrel files

Inside `apps/api` and `apps/web`, import each module by its own path. A barrel (`index.ts` that only
re-exports) makes Vite's dev server eagerly load every module behind it, hurting cold start and HMR,
and buys nothing inside an application bundle.

Inside `packages/shared`, the sub-path exports are the interface; a flat barrel at the package
boundary is acceptable with a clear reason, and intermediate barrels (`schemas/index.ts`,
`types/index.ts`) are not.

### TypeScript

Fix a type gap at its source: narrow the type on the interface, add a type guard, or parse with a Zod
schema. Reach for an assertion (`as SomeType`) only when none of those work, and comment why.

## Dashboard Layer Responsibilities

Applies to every dashboard feature (income, expenses, snapshot, YTD, anticipated budget).

**DB layer** — aggregation and filtering only. Returns summary numbers (monthly totals, grouped
sums), never raw transaction rows.

**Service layer** — business logic over aggregated values. Applies `user_config` percentage splits
(needs/wants/investments), computes derived fields (spending income, net income), applies
rebalancing group offsets. Leaves formatting alone.

**Client layer** — presentation only. Formats numbers, derives percentages from returned totals,
decides colour states. Re-aggregating raw data here is the bug this rule exists to prevent.

**API discipline** — query parameters (e.g. `?year=YYYY`) filter within one response shape. A
different response shape is a different endpoint. Dashboard endpoints return pre-shaped aggregates;
transaction endpoints return lists; they stay separate.

Answer all three before opening a file:

1. What does the DB query return?
2. What does the service layer do with it?
3. What shape does the API response have?

## Tooling

IDE diagnostics that appear right after you add an export or change an import (e.g. "Unsafe call of
a type that could not be resolved") are usually stale TS-server state. Confirm with
`pnpm typecheck` before acting on them.

API `tsc --noEmit` emits pre-existing TS5107 and TS5101 deprecation warnings
(`moduleResolution=node10`, `baseUrl`). Treat only new errors as regressions.

The Bruno collection (`bruno/`) exists in the monorepo root only, not in worktrees. Add new requests
in the main project directory.
