# Finance Dashboard

A full-stack personal finance dashboard for tracking income, expenses, accounts, and budgets with automatic transaction categorization. Built to replace a manually maintained Excel workbook — the goal was a proper data model, multi-account support, and dashboard views that update in real time rather than requiring formula maintenance.

> **Live Demo:** [https://app.ryantyrrell.ca/]

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend framework | React 18 | Component model, broad ecosystem |
| Build tool | Vite 5 | Sub-second HMR, fast production builds |
| Routing | TanStack Router | Type-safe routes with search-param schemas |
| Server state | TanStack Query | Stale-while-revalidate caching, background refetching |
| Styling | Tailwind CSS | Utility-first with a custom semantic design token system |
| UI primitives | Radix UI + shadcn/ui | Accessible headless components |
| API framework | Express 5 (Node/TypeScript) | Async error propagation without try/catch boilerplate |
| ORM + migrations | Drizzle ORM | Type-safe SQL queries, schema-driven migrations |
| Database | PostgreSQL 15 | Relational integrity, window functions for aggregations |
| Validation | Zod | Runtime schema validation shared between API and web |
| Auth | JWT + HttpOnly refresh cookie | Short-lived access tokens, secure refresh rotation |
| AI categorization | Anthropic / OpenAI (pluggable) | Auto-categorize imported transactions; off by default |
| Error tracking | Sentry | Frontend + backend error capture |
| Package manager | pnpm workspaces | Workspace linking, fast installs, strict dependency isolation |
| Containerization | Docker Compose | Reproducible local PostgreSQL with two named databases |

---


## Project Structure

This is a pnpm monorepo with three workspaces.

```
finance-dashboard/
├── apps/
│   ├── api/              # Express 5 REST API — see apps/api/CLAUDE.md
│   └── web/              # React 18 SPA (Vite + TanStack) — see apps/web/CLAUDE.md
├── packages/
│   └── shared/           # Zod schemas, TypeScript types, and shared constants
│                         # consumed by both apps via sub-path imports
├── bruno/                # Bruno API collection (dev + production environments)
├── docs/                 # Infrastructure, seeding, and setup guides
├── infra/                # Deployment configuration
└── scripts/              # Root-level helper scripts
```

### `apps/api`

Feature-based module structure. Each domain feature (`accounts`, `transactions`, `categories`, `dashboards/*`, etc.) owns its routes, service, and error definitions. Cross-feature concerns live in `src/pipelines/` (AI categorization, transfer detection, rebalancing).

### `apps/web`

Feature-based SPA. Each feature owns its page component, hooks, and local components — no cross-feature imports. Shared primitives live in `src/components/ui/` (Radix/shadcn) and `src/components/common/` (app-aware widgets). Data fetching uses dedicated query hooks per feature with React Query.

### `packages/shared`

Import via sub-path only — never the bare package root:

```ts
import { AccountSchema } from "@finance/shared/schemas/accounts";
import { ACCOUNT_TYPES }  from "@finance/shared/constants";
import type { Account }   from "@finance/shared/types/accounts";
```

---

## Local Development

### Prerequisites

- Node >= 20
- pnpm >= 9
- Docker (for PostgreSQL)

### 1. Clone and install

```bash
git clone <repo-url>
cd finance-dashboard
pnpm install
```

### 2. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and set the required values:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/finance_dev
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5434/finance_test
JWT_SECRET=          # 32-byte hex: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_REFRESH_SECRET=  # separate 32-byte hex
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### 3. Start the database

```bash
docker compose up -d postgres
```

This starts PostgreSQL on port **5434** and creates both `finance_dev` and `finance_test` databases.

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. (Optional) Seed sample data

```bash
pnpm seed:dev        # categories and sample transactions
pnpm seed:rules      # categorization rules
```

### 6. Start all apps

```bash
pnpm dev             # starts API (port 3000) and web (port 5173) in parallel
```

The web app is available at `http://localhost:5173`.

---

## Running Tests

Tests are integration tests that run against a real PostgreSQL database (`finance_test`). Migrate the test database before running for the first time:

```bash
pnpm --filter api db:migrate:test
```

| Command | Description |
|---|---|
| `pnpm test` | Full test suite across all workspaces |
| `pnpm --filter api test` | API test suite (single run) |
| `pnpm --filter api test:watch` | API tests in watch mode |
| `pnpm --filter api vitest run <path>` | Single test file |

Example — run one file:

```bash
pnpm --filter api vitest run src/features/accounts/accounts.routes.test.ts
```

Tests run **serially** to avoid database race conditions. The test runner switches the active database connection to `DATABASE_URL_TEST` via the Vitest setup file.

---

## API Testing

A [Bruno](https://www.usebruno.com/) collection lives in the `bruno/` folder at the repo root. It covers all API endpoints across two environments:

| Environment | Base URL |
|---|---|
| `dev` | `http://localhost:3000` |
| `production` | `https://app.ryantyrrell.ca/` |

Open Bruno, select **Open Collection**, and point it at the `bruno/` directory. Switch environments using the environment selector in the top-right corner.

---

## Related Documentation

| Document | Description |
|---|---|
| [`docs/development/infrastructure.md`](docs/development/infrastructure.md) | AWS deployment architecture |
| [`docs/development/environment-setup.md`](docs/development/environment-setup.md) | Detailed local setup guide |
| [`docs/development/seeding-layer.md`](docs/development/seeding-layer.md) | Seeding strategy and environments |
| [`CLAUDE.md`](CLAUDE.md) | Monorepo-level conventions and commands |
| [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) | API architecture rules and patterns |
| [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) | Frontend architecture rules and patterns |
| [`Portfolio`](https://carnation-increase-9e6.notion.site/Finance-Dashboard-35a1e09c304880f6ab07ebc2e3057e37) | Portfolio write-up with design decisions |
