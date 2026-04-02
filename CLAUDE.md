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

`@finance/shared` exports Zod schemas and inferred TypeScript types used by both the API (validation) and the web app (typed API responses). Import as `@finance/shared`.

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
