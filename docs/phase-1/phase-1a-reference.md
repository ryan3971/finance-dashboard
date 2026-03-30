# Phase 1A Reference — Monorepo Scaffold + Auth

> What was built, how it fits together, and how to run it.

---

## Table of Contents

1. [What Was Built](#what-was-built)
2. [Project Structure](#project-structure)
3. [How to Run](#how-to-run)
4. [Package Explanations](#package-explanations)
5. [Auth Flow — How It Works](#auth-flow--how-it-works)
6. [Database Schema](#database-schema)
7. [Environment Variables](#environment-variables)
8. [Useful Commands](#useful-commands)
9. [Known Quirks](#known-quirks)

---

## What Was Built

Phase 1A is the **foundation** — no business logic yet, just the scaffolding everything else will build on top of.

| What | Description |
|---|---|
| **Monorepo structure** | Three packages (`packages/shared`, `apps/api`, `apps/web`) managed together by pnpm workspaces |
| **Shared types library** | TypeScript interfaces and Zod validation schemas shared between the API and web app |
| **REST API** | Express.js server with a health endpoint and a complete JWT auth system |
| **Database schema** | Full Drizzle ORM schema covering all planned tables (users, accounts, transactions, investments, etc.) |
| **Auth endpoints** | Register, login, refresh token, logout — with httpOnly cookies and token rotation |
| **Web app scaffold** | Vite + React + TypeScript + Tailwind — currently just a placeholder page |
| **Tooling** | ESLint, Prettier, TypeScript strict mode, Docker Compose for local Postgres |
| **CI stub** | GitHub Actions workflow that runs typecheck, lint, migrations, and tests on push |

---

## Project Structure

```
finance-dashboard/
├── .env                        # Local secrets — never committed
├── .env.example                # Template for .env — commit this
├── .eslintrc.json              # Lint rules for all packages
├── .gitignore
├── .prettierrc
├── docker-compose.yml          # Local Postgres container
├── package.json                # Workspace root — shared scripts
├── pnpm-workspace.yaml         # Tells pnpm which folders are packages
│
├── packages/
│   └── shared/                 # @finance/shared — types & schemas
│       └── src/
│           ├── types/
│           │   ├── auth.ts     # Auth request/response TypeScript interfaces
│           │   └── adapters.ts # CSV adapter interfaces (used in Phase 1B)
│           └── schemas/
│               └── auth.ts     # Zod validation schemas for register/login
│
├── apps/
│   ├── api/                    # Express REST API
│   │   └── src/
│   │       ├── db/
│   │       │   ├── schema.ts   # Drizzle ORM table definitions (source of truth)
│   │       │   ├── index.ts    # Database connection
│   │       │   └── migrations/ # Auto-generated SQL migration files
│   │       ├── lib/
│   │       │   └── jwt.ts      # JWT sign/verify helpers
│   │       ├── middleware/
│   │       │   ├── auth.ts     # requireAuth middleware (protects routes)
│   │       │   ├── error.ts    # Central error handler
│   │       │   └── logger.ts   # Pino structured logger
│   │       ├── routes/
│   │       │   ├── health.routes.ts    # GET /api/v1/health
│   │       │   ├── auth.routes.ts      # POST /api/v1/auth/*
│   │       │   └── accounts.routes.ts  # GET /api/v1/accounts (stub)
│   │       ├── services/
│   │       │   └── auth.service.ts     # Register, login, refresh, logout logic
│   │       ├── app.ts          # Express app factory
│   │       └── server.ts       # Entry point — starts the HTTP server
│   │
│   └── web/                    # React + Vite frontend
│       └── src/
│           ├── App.tsx         # Placeholder page
│           ├── main.tsx        # React root — sets up QueryClient + Router
│           └── index.css       # Tailwind CSS directives
│
└── .github/
    └── workflows/
        └── ci.yml              # GitHub Actions CI pipeline
```

---

## How to Run

### Prerequisites

```bash
node --version    # Must be >= 20
pnpm --version    # Must be >= 9  (install: npm i -g pnpm)
docker --version  # Docker Desktop must be running
```

### First-time setup

```bash
# 1. Install all dependencies across all packages
pnpm install

# 2. Start Postgres in Docker
docker compose up postgres -d

# 3. Run database migrations (creates all tables)
pnpm db:migrate
```

### Day-to-day development

Run each of these in a separate terminal:

```bash
# Terminal 1 — API (auto-restarts on file changes)
pnpm --filter api dev

# Terminal 2 — Web app (hot reload)
pnpm --filter web dev
```

Then open:
- **Web app**: http://localhost:5173
- **API**: http://localhost:3001

> **Tip:** Postgres runs on port **5434** (not the default 5432) because this machine has a local PostgreSQL 16 installation that already uses 5432. See [Known Quirks](#known-quirks).

### Stop everything

```bash
# Stop Postgres container
docker compose down
```

---

## Package Explanations

### `packages/shared` — `@finance/shared`

This is a **shared TypeScript library** that both the API and the web app can import. The purpose is to define types and validation rules in one place so they stay in sync.

- **TypeScript interfaces** (`src/types/`) — describe the shape of data. For example, `AuthResponse` describes what the register/login endpoints return.
- **Zod schemas** (`src/schemas/`) — runtime validation rules. When a register request comes in, `registerSchema.parse(req.body)` validates it and throws a typed error if it's wrong (e.g., password too short, invalid email).

Because this package's `package.json` uses `"main": "./src/index.ts"`, both the API and web app import directly from the TypeScript source — no build step needed for the shared package during development.

### `apps/api` — The Express API

Built with **Express.js**, a minimal Node.js web framework. Key concepts:

**Middleware** runs on every request before it hits a route handler:
- `httpLogger` — logs each request using Pino (a fast structured logger)
- `express.json()` — parses JSON request bodies
- `cookieParser()` — parses cookies (needed for the refresh token)
- `cors()` — allows the web app (port 5173) to make requests to the API (port 3001)

**Routes** are groups of related endpoints:
- `GET /api/v1/health` — simple "is the server alive?" check
- `POST /api/v1/auth/register` — create account
- `POST /api/v1/auth/login` — get tokens
- `POST /api/v1/auth/refresh` — get a new access token using the refresh token
- `POST /api/v1/auth/logout` — invalidate the refresh token
- `GET /api/v1/accounts` — placeholder, returns `[]` (protected — needs auth)

**Drizzle ORM** is used to talk to Postgres. Instead of writing raw SQL, you write TypeScript:
```typescript
// Example: find a user by email
const [user] = await db
  .select()
  .from(users)
  .where(eq(users.email, 'test@example.com'))
  .limit(1);
```

**The schema file** (`src/db/schema.ts`) is the single source of truth for the database structure. When you change it, you run `pnpm db:generate` to create a new SQL migration file, then `pnpm db:migrate` to apply it.

### `apps/web` — The React Frontend

Built with **Vite** (a fast build tool) and **React**. Currently just a placeholder page.

Pre-installed libraries that will be used in later phases:
- **React Query** — for fetching and caching API data
- **React Router** — for client-side page navigation
- **Axios** — for making HTTP requests to the API
- **Recharts** — for charts and graphs
- **Tailwind CSS** — utility-first CSS framework (e.g., `className="text-gray-900 font-bold"`)

The Vite dev server is configured to **proxy** requests that start with `/api` to `http://localhost:3001`. This means the web app can call `/api/v1/health` and Vite silently forwards it to the API — no CORS issues during development.

---

## Auth Flow — How It Works

The API uses a **two-token system**:

| Token | What it is | Where it lives | Lifespan |
|---|---|---|---|
| **Access token** | A signed JWT containing the user's ID and email | `Authorization: Bearer <token>` header | 15 minutes |
| **Refresh token** | A signed JWT stored as a cookie | `HttpOnly` cookie (can't be read by JavaScript) | 7 days |

### Why two tokens?

A short-lived access token means that if someone steals it, it expires quickly. The longer-lived refresh token is stored in an `HttpOnly` cookie, which JavaScript can't read, making it much harder to steal via XSS attacks.

### Register flow

```
Client → POST /auth/register { email, password }
  → Validate with Zod schema
  → Check email not already taken
  → Hash password with bcrypt (12 rounds)
  → Insert user into DB
  → Issue access token (JWT, 15 min)
  → Issue refresh token (JWT, 7 days)
  → Store SHA-256 hash of refresh token in DB (not the raw token)
  → Set refresh token in HttpOnly cookie
  → Return access token + user in response body
```

### Login flow

Same as register, except instead of creating a user, it looks up the existing user and verifies the password.

The password check uses a **constant-time comparison** even for non-existent users — this prevents an attacker from figuring out whether an email is registered by measuring response time.

### Refresh flow

```
Client → POST /auth/refresh (with cookie automatically attached by browser)
  → Read refresh token from cookie
  → JWT-verify it (checks signature and expiry)
  → Hash it and look up the hash in DB
  → Delete the old token from DB (rotation — one-time use)
  → Issue a new access token + new refresh token
  → Return new access token in response body
  → Set new refresh token in cookie
```

### Logout flow

```
Client → POST /auth/logout (with cookie)
  → Hash the refresh token
  → Delete it from DB
  → Clear the cookie
  → Return 204 No Content
```

### Protecting routes

Any route that requires authentication uses the `requireAuth` middleware:
```typescript
router.get('/', requireAuth, (_req, res) => {
  res.json([]);
});
```

`requireAuth` reads the `Authorization: Bearer <token>` header, verifies the JWT, and attaches the user to `req.user`. If the token is missing or invalid, it immediately returns `401 Unauthorized`.

---

## Database Schema

All 13 tables were created by the initial migration. Here's what they're for:

| Table | Purpose |
|---|---|
| `users` | Accounts — email + hashed password |
| `refresh_tokens` | Active refresh token hashes (one per login session) |
| `accounts` | Financial accounts (chequing, credit card, TFSA, etc.) |
| `categories` | Transaction categories (can be system-wide or user-defined) |
| `categorization_rules` | Keyword-based rules for auto-categorizing transactions |
| `tags` | User-defined tags for transactions |
| `imports` | Record of each CSV file uploaded |
| `transactions` | Individual spending/income transactions |
| `transaction_tags` | Many-to-many join table between transactions and tags |
| `investment_transactions` | Buy/sell/dividend activity in investment accounts |
| `investment_snapshots` | Point-in-time balance snapshots for investment accounts |
| `contribution_records` | TFSA/RRSP/FHSA contribution room tracking |
| `user_config` | Per-user settings (e.g., emergency fund target) |

The schema is defined in [apps/api/src/db/schema.ts](../apps/api/src/db/schema.ts). **Never edit the DB directly** — always change the schema file and run `pnpm db:generate` + `pnpm db:migrate`.

---

## Environment Variables

The `.env` file at the repo root is loaded by the API at startup. It is **never committed** (it's in `.gitignore`). Use `.env.example` as a reference.

| Variable | What it's for | Current value |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `postgresql://postgres:postgres@localhost:5434/finance_dev` |
| `JWT_SECRET` | Signs access tokens | 32-byte hex secret (already generated) |
| `JWT_REFRESH_SECRET` | Signs refresh tokens (different from JWT_SECRET) | 32-byte hex secret (already generated) |
| `PORT` | API port | `3001` |
| `NODE_ENV` | `development` / `production` | `development` |
| `LOG_LEVEL` | Pino log verbosity (`trace`/`debug`/`info`/`warn`/`error`) | `debug` |
| `CORS_ORIGIN` | Which origin the API allows | `http://localhost:5173` |

To regenerate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run this twice to get two different secrets.

---

## Useful Commands

```bash
# Install / update dependencies
pnpm install

# Type-check all packages (zero errors = good)
pnpm typecheck

# Lint all packages (zero errors = good)
pnpm lint

# Run API tests
pnpm --filter api test

# Database commands (all run from repo root)
pnpm db:generate          # Generate a new migration from schema changes
pnpm db:migrate           # Apply pending migrations to the DB
pnpm db:studio            # Open Drizzle Studio (visual DB browser)

# Start just Postgres (most common for dev)
docker compose up postgres -d

# See what tables exist
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d finance_dev -c "\dt"

# Quick API smoke test
curl http://localhost:3001/api/v1/health

# Register a test user
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123"}'
```

---

## Known Quirks

### Postgres runs on port 5434

This machine has PostgreSQL 16 installed locally, which occupies ports 5432 and 5433. The Docker container for this project is mapped to port `5434:5432` instead. If you run this project on a fresh machine with no local Postgres, you can change it back to `5432:5432` in `docker-compose.yml` and update `DATABASE_URL` in `.env`.

### `dotenv` and module loading order

In Node.js, `import` statements are hoisted — they all run before any regular code. This means if `server.ts` has `import { createApp } from './app'` and `dotenv.config(...)` as a statement, the `createApp` module loads *before* dotenv has set `process.env`.

To work around this, two things were done:
1. The database connection (`db/index.ts`) creates the Postgres pool lazily — only when the first query runs, by which time dotenv has loaded.
2. The JWT signing functions read `process.env.JWT_SECRET` at call time (inside the function), not at module load time.

### The refresh token strategy

The spec described storing a random opaque token in the cookie, but also called JWT-verify on it (which would fail). The implementation was corrected to store a **signed JWT** in the cookie and its SHA-256 hash in the database — consistent with how `refreshAccessToken` verifies tokens.
