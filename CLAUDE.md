# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
pnpm seed:dev         # Seed categories, rules, and sample data
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

## Architecture

Pnpm monorepo with three workspaces:

- **`apps/api`** — Express 5 REST API (Node/TypeScript) — see `apps/api/CLAUDE.md`
- **`apps/web`** — React 18 SPA (Vite, React Router, TanStack Query) — see `apps/web/CLAUDE.md`
- **`packages/shared`** — Zod schemas and TypeScript types consumed by both apps

`@finance/shared` exports Zod schemas, TypeScript types, and shared constants (`packages/shared/src/constants.ts`) used by both the API and the web app. Import as `@finance/shared`. If a literal value must be consistent across both apps, it belongs in `constants.ts` — do not duplicate it.

## TypeScript

Avoid type assertions (`as SomeType`). Fix the type gap at its source instead — narrow the type on the interface, use a type guard, or parse with a Zod schema. Only use an assertion as a last resort, and always add a comment explaining why it is unavoidable.

## Tooling

If the TypeScript language server reports unexpected errors (e.g. "Unsafe call of a type that could not be resolved") after editing a file — particularly after adding a new export or changing an import — restart the TS server before investigating further. These are stale diagnostics that clear on restart and are not real errors.

ESLint import-sort errors (e.g. "Expected 'multiple' syntax before 'single' syntax") can be ignored — do not reorder imports to satisfy them.

## Environment

Copy `.env.example` to `apps/api/.env`. Key variables:

```
DATABASE_URL          # Dev DB connection
DATABASE_URL_TEST     # Test DB connection
JWT_SECRET            # 32-byte hex — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_REFRESH_SECRET    # Separate 32-byte hex secret
PORT=3001
CORS_ORIGIN=http://localhost:5173
ENABLE_AI_CATEGORIZATION=false
AI_PROVIDER=anthropic  # or openai
```
