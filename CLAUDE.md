# Finance Dashboard

Personal finance dashboard for tracking transactions, accounts, budgets, and spending patterns across income, expenses, and investments.

## Monorepo Structure

Pnpm monorepo with three workspaces:

- **`apps/api`** — Express 5 REST API (Node/TypeScript) — see [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md)
- **`apps/web`** — React 18 SPA (Vite, TanStack Router, TanStack Query) — see [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md)
- **`packages/shared`** — Zod schemas and TypeScript types consumed by both apps

## Commands

**From the repo root:**

```bash
pnpm dev              # Start all apps in watch mode
pnpm build            # Build all workspaces
pnpm typecheck        # Type-check all workspaces
pnpm lint             # ESLint across all workspaces
pnpm test             # Run all tests

pnpm db:migrate       # Run migrations against DATABASE_URL (dev)
pnpm db:studio        # Open Drizzle Studio
pnpm seed:dev         # Seed accounts, categories, rules, transactions, anticipated budget, and rebalancing groups (finance_dev only)
pnpm seed:system      # Seed system categories and categorization rules only
```

**Scoped to the API:**

```bash
pnpm --filter api test           # Run full test suite once
pnpm --filter api test:watch     # Watch mode
pnpm --filter api db:migrate:test  # Migrate test DB
```

**Run a single test file:**

```bash
pnpm --filter api vitest run src/features/accounts/accounts.routes.test.ts
```

**When working in a git worktree (`.claude/worktrees/`):**

Worktrees share the git repository but not `node_modules`. All `pnpm` commands that invoke binaries (`vitest`, `tsc`, etc.) must be run from the monorepo root, not the worktree directory.

## Environment

Each app has its own `.env` — copy the relevant `.env.example` before starting.

**`apps/api/.env`** — backend config:

```
DATABASE_URL          # Dev DB connection (postgres://...localhost:5434/finance_dev)
DATABASE_URL_TEST     # Test DB connection (postgres://...localhost:5434/finance_test)
JWT_SECRET            # 32-byte hex — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_REFRESH_SECRET    # Separate 32-byte hex secret
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug       # debug | info | warn | error
CORS_ORIGIN=http://localhost:5173
ENABLE_AI_CATEGORIZATION=false
AI_PROVIDER=anthropic  # or openai
AI_CONFIDENCE_THRESHOLD=0.70
TRANSFER_DETECTION_WINDOW_DAYS=3
ANTHROPIC_API_KEY     # Required when ENABLE_AI_CATEGORIZATION=true and AI_PROVIDER=anthropic
OPENAI_API_KEY        # Required when AI_PROVIDER=openai
SENTRY_DSN            # Error tracking — leave blank in local dev
```

**`apps/web/.env`** — frontend config:

```
VITE_API_URL=http://localhost:3000   # API base URL (proxied via Vite in dev)
VITE_ENV=development
VITE_SENTRY_DSN=                     # Error tracking — leave blank in local dev
```

## Shared Conventions

### `packages/shared`

`@finance/shared` exports Zod schemas, TypeScript types, and shared constants (`packages/shared/src/constants.ts`) used by both the API and the web app. Use sub-path imports — `@finance/shared/constants`, `@finance/shared/schemas/<name>`, `@finance/shared/types/<name>` — never the bare `@finance/shared` package root. If a literal value must be consistent across both apps, it belongs in `constants.ts` — do not duplicate it.

### Barrel files

Do not create barrel files (`index.ts` files whose sole purpose is re-exporting from other files) inside `apps/api` or `apps/web`. They force Vite's dev server to eagerly load every module they re-export, hurting cold-start and HMR times, and they provide no benefit inside an application bundle.

A flat barrel at the `packages/shared` package boundary is acceptable if there is a clear reason, but prefer sub-path imports. Never add intermediate barrels inside `packages/shared` (e.g. `schemas/index.ts`, `types/index.ts`).

### TypeScript

Avoid type assertions (`as SomeType`). Fix the type gap at its source instead — narrow the type on the interface, use a type guard, or parse with a Zod schema. Only use an assertion as a last resort, and always add a comment explaining why it is unavoidable.

## Dashboard Layer Responsibilities

These rules apply to every dashboard feature (income, expenses, snapshot, YTD, anticipated budget). Violating them produces incorrect behaviour or unmaintainable code — follow them strictly.

**DB layer** — aggregation and filtering only. Returns summary numbers (monthly totals, grouped sums). Never returns raw transaction rows to the dashboard layer.

**Service layer** — business logic applied to aggregated values. Applies `user_config` percentage splits (needs/wants/investments), computes derived fields (spending income, net income), and applies rebalancing group offsets. Does not reformat for the client.

**Client layer** — presentation derivations only. Formats numbers, derives percentages from returned totals, decides colour states. Never re-aggregates raw data.

**API discipline** — query parameters (e.g. `?year=YYYY`) filter the same response shape; they do not change it. When the response shape changes, that is a different endpoint. Dashboard endpoints are separate from transaction endpoints — they return pre-shaped aggregates, never filtered transaction lists.

Before writing any dashboard feature, answer these three questions:

1. What does the DB query return?
2. What does the service layer do with it?
3. What shape does the API response have?

Do not touch a file until all three are answered.

## Tooling

If the TypeScript language server reports unexpected errors (e.g. "Unsafe call of a type that could not be resolved") after editing a file — particularly after adding a new export or changing an import — restart the TS server before investigating further. These are stale diagnostics that clear on restart and are not real errors.

The API `tsc --noEmit` output includes pre-existing TS5107 and TS5101 deprecation warnings (`moduleResolution=node10`, `baseUrl`) that are not real errors — ignore them when checking typecheck output for regressions.

The Bruno collection (`bruno/`) lives in the monorepo root only and is not present in git worktrees. Add new requests to the main project directory.
