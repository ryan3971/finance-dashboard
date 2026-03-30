# Phase 1B Reference

CSV Adapters · Import Pipeline · Categorization · Transaction UI

---

## What Was Built

| # | Piece | Location | Description |
|---|-------|----------|-------------|
| 1 | Shared adapter interface | `packages/shared/src/types/adapters.ts` | `CsvAdapter` with updated `parse(rows, accountId)` signature |
| 2 | Category seed | `apps/api/src/db/seeds/` | 19 system categories (`userId=null`) including `Uncategorized` |
| 3 | Import utilities | `apps/api/src/services/imports/utils.ts` | `parseDate`, `parseAmount`, `normaliseDescription`, `buildCompositeKey` |
| 4 | File parsers | `apps/api/src/services/imports/parser.ts` | `parseCsv` (quoted-field safe), `parseXlsx` (uses `xlsx` lib) |
| 5 | Amex adapter | `apps/api/src/services/imports/adapters/amex.adapter.ts` | Parses Amex CSV; negates amounts (positive = charge in Amex format) |
| 6 | CIBC adapter | `apps/api/src/services/imports/adapters/cibc.adapter.ts` | No header; detects masked card number in col[4] |
| 7 | TD adapter | `apps/api/src/services/imports/adapters/td.adapter.ts` | No header; 5 columns; col[4] is running balance (ignored) |
| 8 | Questrade adapter | `apps/api/src/services/imports/adapters/questrade.adapter.ts` | XLSX; maps action codes (`DIV`, `TF6`, …) and account types (`TFSA`, `RRSP`, …) |
| 9 | Test fixtures | `apps/api/src/services/imports/adapters/__fixtures__/` | `amex.csv`, `cibc.csv`, `td.csv`, `questrade-fixture.ts` (builds XLSX buffer) |
| 10 | Adapter registry | `apps/api/src/services/imports/registry.ts` | `getAdapterByInstitution()`, `detectAdapter()` — detection order: Questrade → Amex → CIBC → TD |
| 11 | Categorization pipeline | `apps/api/src/services/categorization/` | Rules engine (keyword match, priority DESC) + fallback to `Uncategorized` + `flaggedForReview` |
| 12 | Import service | `apps/api/src/services/imports/import.service.ts` | Full pipeline: parse → adapt → categorize → persist; tracks imported/duplicate/error counts |
| 13 | Accounts routes | `apps/api/src/routes/accounts.routes.ts` | `GET /`, `POST /`, `GET /:id` — replaced stub with full implementation |
| 14 | Imports route | `apps/api/src/routes/imports.routes.ts` | `POST /upload` — multer memory storage, 10 MB limit |
| 15 | Transactions route | `apps/api/src/routes/transactions.routes.ts` | `GET /` — paginated, filterable, user-scoped via accounts join |
| 16 | Route mounting | `apps/api/src/app.ts` | Mounted imports and transactions routers |
| 17 | Transaction list UI | `apps/web/src/App.tsx` | React table: date, description, signed amount (red/green), category, account; flagged rows highlighted |
| 18 | Vite env types | `apps/web/src/vite-env.d.ts` | `/// <reference types="vite/client" />` for `import.meta.env` |
| 19 | jti refresh token fix | `apps/api/src/lib/jwt.ts` | Injects `jti: randomBytes(16)` into refresh JWT to guarantee uniqueness |
| 20 | Adapter unit tests | `apps/api/src/services/imports/adapters/*.test.ts` | 18 pure unit tests (no DB) |
| 21 | Integration tests | `apps/api/src/routes/*.routes.test.ts` | 27 integration tests for accounts, imports, transactions |

**Final state:** 45/45 tests pass · `pnpm typecheck` zero errors across all packages.

---

## Project Structure

```
Finance Dashboard/
├── .env                          # Single secrets file for the whole monorepo (gitignored)
├── .env.example                  # Template — copy to .env and fill in secrets
├── docker-compose.yml            # Postgres on host port 5434; optional full-stack container
├── package.json                  # Root pnpm workspace config
├── pnpm-workspace.yaml           # Declares apps/* and packages/*
├── turbo.json                    # Turborepo pipeline (typecheck, build, test)
│
├── packages/
│   └── shared/                   # Zero-runtime shared types — consumed by api and web
│       └── src/
│           ├── index.ts          # Barrel export
│           ├── types/
│           │   ├── adapters.ts   # CsvAdapter interface, AdapterOutput, ValidationResult
│           │   └── ...           # JwtPayload, RegisterInput, LoginInput, etc.
│           └── schemas/          # Zod schemas (registerSchema, loginSchema)
│
├── apps/
│   ├── api/                      # Express REST API
│   │   ├── src/
│   │   │   ├── server.ts         # Entry point — dotenv.config() BEFORE app imports
│   │   │   ├── app.ts            # createApp() — wires middleware and all routers
│   │   │   ├── db/
│   │   │   │   ├── index.ts      # Drizzle client (postgres-js driver)
│   │   │   │   ├── schema.ts     # All 13 table definitions
│   │   │   │   └── seeds/
│   │   │   │       ├── categories.ts   # 19 system categories (userId=null)
│   │   │   │       └── index.ts        # Seed entry point
│   │   │   ├── lib/
│   │   │   │   └── jwt.ts        # signAccessToken, signRefreshToken (with jti), verify*
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts       # requireAuth — verifies Bearer token, sets req.user
│   │   │   │   ├── error.ts      # Central error handler (ZodError → 400, etc.)
│   │   │   │   └── logger.ts     # Pino logger
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── accounts.routes.ts
│   │   │   │   ├── imports.routes.ts
│   │   │   │   └── transactions.routes.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── categorization/
│   │   │   │   │   ├── pipeline.types.ts   # CategorizationResult interface
│   │   │   │   │   ├── rules-engine.ts     # Keyword matching, ADD sentinel
│   │   │   │   │   └── pipeline.ts         # categorize() — rules then fallback
│   │   │   │   └── imports/
│   │   │   │       ├── utils.ts            # parseDate, parseAmount, buildCompositeKey
│   │   │   │       ├── parser.ts           # parseCsv, parseXlsx
│   │   │   │       ├── registry.ts         # Adapter lookup + auto-detect
│   │   │   │       ├── import.service.ts   # processImport() — full pipeline
│   │   │   │       └── adapters/
│   │   │   │           ├── amex.adapter.ts
│   │   │   │           ├── cibc.adapter.ts
│   │   │   │           ├── td.adapter.ts
│   │   │   │           ├── questrade.adapter.ts
│   │   │   │           ├── index.ts        # Barrel export
│   │   │   │           └── __fixtures__/   # CSV files + Questrade XLSX builder
│   │   │   └── test/
│   │   │       └── setup.ts      # Vitest setup — loads .env for test runs
│   │   └── vitest.config.ts      # fileParallelism: false (critical for shared DB)
│   │
│   └── web/                      # Vite + React frontend
│       └── src/
│           ├── App.tsx           # TransactionList — useQuery + axios
│           └── vite-env.d.ts     # /// <reference types="vite/client" />
│
└── docs/
    ├── phase-1a-reference.md     # Auth stack, schema, first-time setup
    └── phase-1b-reference.md     # This file
```

---

## How to Run

### First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill in secrets
cp .env.example .env
# Edit .env — see Environment Variables section below

# 3. Start Postgres
docker compose up -d postgres

# 4. Run migrations
pnpm --filter api db:migrate

# 5. Seed system categories (required before any import)
pnpm --filter api db:seed

# 6. Start both servers
pnpm dev
```

### Day-to-day dev

```bash
# Start everything (API on :3001, web on :5173)
pnpm dev

# Start only the API
pnpm --filter api dev

# Start only the web app
pnpm --filter web dev

# Run all tests
pnpm test

# Run only API tests
pnpm --filter api test

# Run tests in watch mode
pnpm --filter api test -- --watch

# Type-check everything
pnpm typecheck
```

### How to stop

```bash
# Stop dev servers — Ctrl+C in the terminal running pnpm dev

# Stop Postgres
docker compose down

# Stop Postgres and delete all data (full reset)
docker compose down -v
```

---

## Package Explanations

### `packages/shared`

Contains types and Zod validation schemas that are used by both the API and the web app. It has **no runtime dependencies** beyond Zod — it's pure TypeScript that gets compiled away. Keeping these here prevents the API and web from drifting out of sync on things like `JwtPayload`, `RegisterInput`, and the `CsvAdapter` interface.

### `apps/api`

The Express REST API. Responsibilities:
- Auth: register, login, refresh tokens, logout
- Accounts: CRUD for bank/card accounts
- Imports: receive uploaded files, parse, categorize, and persist transactions
- Transactions: query stored transactions with filtering and pagination

The API is the only thing that touches the database. It uses Drizzle ORM with `postgres-js` as the driver. All secrets live in the root `.env`.

### `apps/web`

The Vite + React frontend. Currently contains a single `TransactionList` component that fetches `GET /api/v1/transactions` and renders a table. Full auth flow (login screen, token storage, auto-refresh) is deferred to Phase 1C. For local development, put a short-lived access token from a register/login call into `VITE_ACCESS_TOKEN` in `.env`.

---

## Auth Flow

The API uses a **two-token design**: a short-lived access token for API calls and a long-lived refresh token for session continuity.

### Why two tokens?

A single long-lived token can't be revoked without a blocklist — if it leaks, an attacker has access until expiry. A refresh token scheme lets the server hold one revocable secret (the refresh token hash) while keeping access tokens stateless and cheap to verify.

### Step-by-step: Register

```
Client                              API
  |                                  |
  | POST /api/v1/auth/register       |
  | { email, password }              |
  |--------------------------------->|
  |                                  | 1. Validate with registerSchema (Zod)
  |                                  | 2. bcrypt.hash(password, 10)
  |                                  | 3. INSERT users
  |                                  | 4. signAccessToken({ sub: userId, email }) → 15m JWT
  |                                  | 5. signRefreshToken({ sub: userId, email }) → 7d JWT (+ jti)
  |                                  | 6. SHA-256 hash of refresh JWT
  |                                  | 7. INSERT refresh_tokens (tokenHash, expiresAt)
  |                                  | 8. Set-Cookie: refresh_token=<JWT>; HttpOnly; SameSite=Strict; Path=/api/v1/auth
  | 201 { accessToken, user }        |
  |<---------------------------------|
```

### Step-by-step: Login

Same as register from step 4 onwards. Returns 401 if email unknown or password doesn't match.

### Step-by-step: Authenticated request

```
Client                              API
  |                                  |
  | GET /api/v1/accounts             |
  | Authorization: Bearer <token>    |
  |--------------------------------->|
  |                                  | requireAuth middleware:
  |                                  | 1. Extract token from Authorization header
  |                                  | 2. verifyAccessToken(token) — checks signature + expiry
  |                                  | 3. Set req.user = { id, email }
  |                                  | 4. next() → route handler
  | 200 [...]                        |
  |<---------------------------------|
```

If the access token is missing, malformed, or expired → 401 immediately. No DB lookup needed.

### Step-by-step: Refresh

```
Client                              API
  |                                  |
  | POST /api/v1/auth/refresh        |
  | Cookie: refresh_token=<JWT>      |
  |--------------------------------->|
  |                                  | 1. Read refresh_token cookie
  |                                  | 2. verifyRefreshToken(cookie) — check signature + expiry
  |                                  | 3. SHA-256 hash of the incoming JWT
  |                                  | 4. SELECT refresh_tokens WHERE tokenHash = hash
  |                                  |    → 401 if not found (already rotated or revoked)
  |                                  | 5. DELETE old token row (rotation — one use per token)
  |                                  | 6. Issue new access token + new refresh token
  |                                  | 7. INSERT new refresh_tokens row
  |                                  | 8. Set-Cookie: refresh_token=<new JWT>
  | 200 { accessToken }              |
  |<---------------------------------|
```

Token rotation means a stolen refresh token can only be used once before it's invalidated.

### Step-by-step: Logout

```
Client                              API
  |                                  |
  | POST /api/v1/auth/logout         |
  | Cookie: refresh_token=<JWT>      |
  |--------------------------------->|
  |                                  | 1. Read cookie
  |                                  | 2. SHA-256 hash
  |                                  | 3. DELETE refresh_tokens WHERE tokenHash = hash
  |                                  | 4. clearCookie('refresh_token')
  | 204 No Content                   |
  |<---------------------------------|
```

After logout, the refresh token is deleted from the DB. Existing access tokens remain valid until their 15-minute expiry — this is acceptable for this use case.

### Token storage summary

| Token | Lives | Stored client-side | Stored server-side |
|-------|-------|--------------------|--------------------|
| Access token | 15 minutes | In-memory (JS variable) | Never |
| Refresh token | 7 days | `HttpOnly` cookie | SHA-256 hash in `refresh_tokens` table |

The refresh token cookie uses `Path: /api/v1/auth` so the browser only sends it to auth endpoints — it is never visible to other route handlers or JavaScript.

---

## Database Schema

All tables are created by the Phase 1A migrations. No new migrations were added in Phase 1B.

### Auth

| Table | Purpose |
|-------|---------|
| `users` | One row per registered user. Stores `email` and `password_hash` (bcrypt). |
| `refresh_tokens` | Active sessions. Each row is one issued refresh token (stored as SHA-256 hash). Deleted on logout or rotation. Cascades on user delete. |

### Accounts

| Table | Purpose |
|-------|---------|
| `accounts` | A bank account or card. Belongs to a user. `institution` determines which CSV adapter is used on upload. `isCredit` controls sign conventions in some reports. |

### Categories

| Table | Purpose |
|-------|---------|
| `categories` | Hierarchical. `userId=null` = system category (seeded). `parentId` links subcategories to parents. `isIncome` distinguishes income from expense categories. |
| `categorization_rules` | Keyword → category mapping. `userId=null` = system rule. Matched by `normalised_description.includes(keyword)` in priority DESC order. `ADD` sentinel = flag for review without assigning a category. |
| `tags` | User-defined labels that can be applied to transactions (many-to-many). |

### Imports & Transactions

| Table | Purpose |
|-------|---------|
| `imports` | One row per file upload. Tracks status (`pending`→`processing`→`complete`/`error`), row counts (imported, duplicate, flagged, error), and the original filename. `s3_key` is reserved for Phase 4 (currently set to filename). |
| `transactions` | One row per financial transaction. `compositeKey` (unique) prevents duplicates on re-upload. `flaggedForReview` marks rows that need manual categorization. `categorySource` records how the category was assigned (`rule`, `ai`, `manual`, `default`). |
| `transaction_tags` | Junction table linking transactions to tags. Cascade-deletes when either side is removed. |

### Investments

| Table | Purpose |
|-------|---------|
| `investment_transactions` | Questrade activity: buys, sells, dividends, transfers. Has `action`, `symbol`, `quantity`, `price`, `commission` fields. Uses same `compositeKey` deduplication pattern. |
| `investment_snapshots` | Point-in-time account balance snapshots (for charting growth over time). Not populated by Phase 1B. |
| `contribution_records` | TFSA/RRSP contribution room tracking per tax year. Not populated by Phase 1B. |

### Config

| Table | Purpose |
|-------|---------|
| `user_config` | One row per user. Stores user preferences (e.g. `emergencyFundTarget`). |

---

## Environment Variables

All variables live in `.env` at the monorepo root.

| Variable | Required | Purpose | How to regenerate |
|----------|----------|---------|-------------------|
| `DATABASE_URL` | Yes | Postgres connection string | Change host/port/db name as needed |
| `JWT_SECRET` | Yes | Signs access tokens (HMAC-SHA256) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Yes | Signs refresh tokens — must differ from `JWT_SECRET` | Same command as above, run again |
| `PORT` | No | API listen port (default: `3001`) | — |
| `NODE_ENV` | No | `development` / `production` — controls cookie `secure` flag | — |
| `LOG_LEVEL` | No | Pino log level (`debug`, `info`, `warn`, `error`) | — |
| `CORS_ORIGIN` | No | Allowed origin for CORS (default: `http://localhost:5173`) | — |
| `OPENAI_API_KEY` | Phase 2 | AI categorization (not used yet) | — |
| `AWS_REGION` | Phase 4 | S3 file storage (not used yet) | — |
| `S3_BUCKET_NAME` | Phase 4 | S3 bucket name (not used yet) | — |

**The two JWT secrets must be different.** If they are the same, a refresh token could be verified as an access token (and vice versa), breaking the security model.

### Web app variable

| Variable | File | Purpose |
|----------|------|---------|
| `VITE_ACCESS_TOKEN` | `apps/web/.env.local` | Short-lived token for local dev (get one from `POST /api/v1/auth/register`) |

---

## Useful Commands

```bash
# Get a fresh access token for local dev / testing
curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","password":"password123"}' \
  | jq -r '.accessToken'

# Create an account
curl -s -X POST http://localhost:3001/api/v1/accounts \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"name":"Amex Gold","type":"credit","institution":"amex","isCredit":true}' \
  | jq .

# Upload a CSV (returns importedCount, duplicateCount, errorCount)
curl -s -X POST http://localhost:3001/api/v1/imports/upload \
  -H 'Authorization: Bearer <TOKEN>' \
  -F 'accountId=<ACCOUNT_ID>' \
  -F 'file=@/path/to/statement.csv' \
  | jq .

# List transactions (first page)
curl -s "http://localhost:3001/api/v1/transactions?account_id=<ACCOUNT_ID>&limit=20" \
  -H 'Authorization: Bearer <TOKEN>' \
  | jq '.data | length, .[0]'

# List only flagged transactions
curl -s "http://localhost:3001/api/v1/transactions?flagged=true" \
  -H 'Authorization: Bearer <TOKEN>' \
  | jq '.data[].description'

# Generate a new JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Reset the database completely (drop data volume)
docker compose down -v && docker compose up -d postgres
pnpm --filter api db:migrate
pnpm --filter api db:seed

# Run a single test file
pnpm --filter api test src/routes/imports.routes.test.ts

# Check what's in the categories table
psql postgresql://postgres:postgres@localhost:5434/finance_dev -c \
  "SELECT name, parent_id IS NULL AS is_parent FROM categories WHERE user_id IS NULL ORDER BY name;"
```

---

## Known Quirks

### Port 5434 (not 5432)

Postgres listens on **host port 5434** (`docker-compose.yml`: `5434:5432`). This is intentional — if you already have a local Postgres installation using 5432, Docker won't conflict with it.

- `.env` / `DATABASE_URL` uses `:5434`
- Inside Docker containers (e.g. the `api` service), the internal hostname is `postgres` on port `5432`
- If you connect with a GUI (TablePlus, DataGrip, etc.) use port **5434**

### dotenv / module hoisting

Node's module system caches `require`/`import` on first use. If any module that reads `process.env` (e.g. the Drizzle client) is imported before `dotenv.config()` runs, it sees empty environment variables.

The fix: call `dotenv.config()` **as the very first statement** in any entry point (`server.ts`, `seeds/index.ts`) before importing anything else. The `import` statements are hoisted by the bundler/runtime, but `dotenv.config()` being at the top of the file ensures it runs in the right order in the CommonJS evaluation sequence used by `tsx`.

```typescript
// server.ts — CORRECT
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });   // ← runs before the module below is evaluated
import { createApp } from './app';       // app.ts imports db.ts which reads DATABASE_URL
```

### Refresh token hash collision (the jti fix)

`jwt.sign()` is **deterministic** for identical inputs. Before the fix, if two calls to `signRefreshToken({ sub, email })` happened within the same second (e.g. a `beforeEach` registers a user, then the test immediately logs in), both produced identical JWTs — and therefore identical SHA-256 hashes. Inserting the second hash violated the `refresh_tokens.token_hash` unique constraint.

The fix adds `jti: randomBytes(16).toString('hex')` to the JWT payload. `jti` (JWT ID) is a standard claim for exactly this purpose — it makes every token cryptographically unique regardless of timing. This is also a production correctness fix, not just a test workaround: two logins in the same second would have caused a 500 error in prod.

```typescript
// apps/api/src/lib/jwt.ts
export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(
    { ...payload, jti: randomBytes(16).toString('hex') },
    refreshSecret(),
    { expiresIn: '7d' }
  );
}
```

### `fileParallelism: false` in Vitest

The integration tests all share the same Postgres database and use the same test email address (`test@example.com`). If Vitest runs test files in parallel (its default), the `beforeEach` cleanup in one file races with inserts in another, causing duplicate-key errors on `users_email_unique`.

`fileParallelism: false` in `apps/api/vitest.config.ts` forces test files to run sequentially. Tests within a single file still run in the declared order. There is no performance concern here — the test suite is small.

### Amount sign convention

All adapters follow the same convention: **negative = money out, positive = money in**.

Amex exports are the exception to be aware of: their CSVs show charges as positive numbers. The `AmexAdapter` negates all amounts during `parse()`. This is easy to forget when reading raw Amex CSV data alongside what's stored in the DB.

### `s3_key` in the `imports` table

The `imports` table has an `s3_key` column (not null). In Phase 1B this is set to the original filename as a placeholder. S3 upload is not implemented until Phase 4. Do not treat this column as a real S3 key until then.
