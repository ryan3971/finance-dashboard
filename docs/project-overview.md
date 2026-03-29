# Finance Dashboard — Project Overview

A personal reference explaining what was built, how it works, and how to run it.
Covers Phases 1A, 1B, and 1C in full.

---

## Table of Contents

1. [What This Project Is](#what-this-project-is)
2. [The Big Picture — How Everything Connects](#the-big-picture--how-everything-connects)
3. [Project Structure](#project-structure)
4. [How to Run It](#how-to-run-it)
5. [Technology Choices — What and Why](#technology-choices--what-and-why)
6. [The Database](#the-database)
7. [The API — Every Endpoint Explained](#the-api--every-endpoint-explained)
8. [How Auth Works](#how-auth-works)
9. [How CSV Imports Work](#how-csv-imports-work)
10. [How Categorization Works](#how-categorization-works)
11. [The Web App](#the-web-app)
12. [Testing](#testing)
13. [Useful Commands Reference](#useful-commands-reference)
14. [Concepts Glossary](#concepts-glossary)

---

## What This Project Is

A personal finance dashboard that replaces a spreadsheet. The core workflow:

1. Export a CSV from your bank (CIBC, TD, Amex, or Questrade)
2. Upload it to the app
3. The app parses it, figures out what each transaction is (groceries, gas, eating out…), and stores it
4. You see a categorized list of transactions in the browser

**What makes this non-trivial:** Every bank exports CSVs in a different format. The dates are formatted differently, the amount columns are different, and some banks don't even have a header row. The app has a separate adapter for each bank that knows how to parse that bank's specific format.

**What was built across three phases:**

| Phase | What it produced |
|-------|-----------------|
| 1A | Monorepo scaffold, Postgres schema, complete JWT auth API |
| 1B | CSV import pipeline for all 4 banks, categorization engine, transaction list UI |
| 1C | Categorization rules seeded, categories API, full login/register UI, more tests |

---

## The Big Picture — How Everything Connects

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (port 5173)                     │
│                                                                 │
│  React + Vite                                                   │
│                                                                 │
│  /login ──────────────────────────────────────────────────────┐ │
│  /register ─────────────────────────────────────────────────┐ │ │
│  / (transactions) ──────── protected ──────────────────────┐│ │ │
│                                                            ││ │ │
│  AuthContext ─── stores JWT in localStorage ───────────────┼┘ │ │
│  api.ts ─── axios instance, attaches Bearer token ─────────┘  │ │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP (JSON)
                               │ port 3001
┌──────────────────────────────▼──────────────────────────────────┐
│                         Express API                             │
│                                                                 │
│  requireAuth middleware — verifies JWT on every protected route │
│                                                                 │
│  /api/v1/auth/*        — register, login, refresh, logout       │
│  /api/v1/accounts/*    — CRUD for bank accounts                 │
│  /api/v1/imports/upload — accepts CSV file upload               │
│  /api/v1/transactions  — list transactions with filters         │
│  /api/v1/categories    — list categories (for dropdowns)        │
│                                                                 │
│  Import pipeline:                                               │
│    CSV file → adapter (per bank) → categorize → store in DB    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ SQL (Drizzle ORM)
┌──────────────────────────────▼──────────────────────────────────┐
│                    PostgreSQL (port 5434)                       │
│                                                                 │
│  users · refresh_tokens · accounts · categories                 │
│  categorization_rules · imports · transactions                  │
│  investment_transactions · tags · user_config · ...             │
└─────────────────────────────────────────────────────────────────┘
```

The **web app** never talks to the database directly. Everything goes through the API. This is a standard pattern called a **client-server architecture** — the API is the gatekeeper.

---

## Project Structure

```
finance-dashboard/                 ← repo root
│
├── .env                           ← your secrets (gitignored, never committed)
├── .env.example                   ← template showing what secrets are needed
├── docker-compose.yml             ← runs Postgres in Docker
├── package.json                   ← root workspace scripts (pnpm dev, test, etc.)
├── pnpm-workspace.yaml            ← tells pnpm that apps/* and packages/* are packages
│
├── scripts/
│   └── seed-rules.ts              ← one-time script: inserts categorization rules into DB
│
├── packages/
│   └── shared/                    ← @finance/shared — types used by BOTH api and web
│       └── src/
│           ├── types/             ← TypeScript interfaces (what data looks like)
│           └── schemas/           ← Zod validation schemas (are the inputs valid?)
│
├── apps/
│   ├── api/                       ← Express REST API (Node.js backend)
│   │   └── src/
│   │       ├── server.ts          ← entry point, starts the HTTP server
│   │       ├── app.ts             ← wires middleware + all routes together
│   │       ├── db/
│   │       │   ├── schema.ts      ← THE source of truth for all DB tables
│   │       │   ├── index.ts       ← Drizzle client (the DB connection)
│   │       │   ├── migrations/    ← SQL files auto-generated from schema.ts
│   │       │   └── seeds/
│   │       │       ├── categories.ts   ← inserts the 19 system categories
│   │       │       └── index.ts        ← runs the seed
│   │       ├── lib/
│   │       │   └── jwt.ts         ← helpers to sign and verify JWTs
│   │       ├── middleware/
│   │       │   ├── auth.ts        ← requireAuth: checks Bearer token on protected routes
│   │       │   ├── error.ts       ← catches all thrown errors and returns proper HTTP responses
│   │       │   └── logger.ts      ← Pino structured logger (logs as JSON)
│   │       ├── routes/
│   │       │   ├── auth.routes.ts          ← register, login, refresh, logout
│   │       │   ├── accounts.routes.ts      ← CRUD for accounts
│   │       │   ├── imports.routes.ts       ← CSV upload endpoint
│   │       │   ├── transactions.routes.ts  ← list + filter transactions
│   │       │   └── categories.routes.ts    ← list categories (nested tree)
│   │       └── services/
│   │           ├── auth.service.ts         ← auth business logic
│   │           ├── categorization/
│   │           │   ├── rules-engine.ts     ← keyword matching logic
│   │           │   └── pipeline.ts         ← categorize() function
│   │           └── imports/
│   │               ├── import.service.ts   ← orchestrates the full import pipeline
│   │               ├── parser.ts           ← CSV and XLSX parsing
│   │               ├── registry.ts         ← picks the right adapter for each bank
│   │               ├── utils.ts            ← parseDate, parseAmount, normaliseDescription
│   │               └── adapters/
│   │                   ├── amex.adapter.ts
│   │                   ├── cibc.adapter.ts
│   │                   ├── td.adapter.ts
│   │                   ├── questrade.adapter.ts
│   │                   └── __fixtures__/   ← sample CSV files used in tests
│   │
│   └── web/                       ← React frontend (Vite)
│       └── src/
│           ├── App.tsx            ← router: maps URLs to page components
│           ├── main.tsx           ← React entry: wraps app in providers
│           ├── lib/
│           │   └── api.ts         ← axios instance (all API calls go through this)
│           ├── contexts/
│           │   └── AuthContext.tsx ← global auth state (logged in? who?)
│           ├── components/
│           │   └── ProtectedRoute.tsx ← redirects to /login if not authenticated
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   ├── RegisterPage.tsx
│           │   └── TransactionsPage.tsx
│           ├── hooks/
│           │   ├── useTransactions.ts  ← fetches + caches transaction list
│           │   └── useCategories.ts    ← fetches + caches category tree
│           └── dashboards/        ← empty subdirs scaffolded for Phase 2
│               ├── snapshot/
│               ├── income/
│               ├── expenses/
│               └── investments/
│
└── docs/
    ├── phase-1a-reference.md      ← technical handoff: auth stack + schema
    ├── phase-1b-reference.md      ← technical handoff: import pipeline
    ├── phase-1c-reference.md      ← technical handoff: auth UI + rules + tests
    └── project-overview.md        ← this file
```

---

## How to Run It

### Prerequisites

You need these installed:

```bash
node --version    # needs to be v20 or higher
pnpm --version    # needs to be v9 or higher — install with: npm i -g pnpm
docker --version  # Docker Desktop needs to be running
```

### First-time setup (do this once)

```bash
# 1. Install all dependencies for all packages at once
pnpm install

# 2. Start Postgres in Docker (runs in the background)
docker compose up postgres -d

# 3. Create all the database tables
pnpm db:migrate

# 4. Seed the 19 system categories (Food, Transport, etc.)
pnpm --filter api db:seed

# 5. Seed the categorization rules (~55 merchant → category mappings)
pnpm seed:rules
```

### Start the app

```bash
# Starts both the API (port 3001) and web app (port 5173) simultaneously
pnpm dev
```

Then open **http://localhost:5173** in your browser.

You'll land on `/login`. Click "Create one" to register, then log in. The first time there are no transactions — use the API to upload a CSV (see commands below), then refresh the page.

### Start only one piece

```bash
pnpm --filter api dev    # just the API
pnpm --filter web dev    # just the web app
```

### Stop everything

```bash
# Ctrl+C in the terminal running pnpm dev

# Stop the Postgres container
docker compose down

# Stop and DELETE all data (full reset)
docker compose down -v
```

### After a full reset, redo the one-time setup:

```bash
pnpm db:migrate
pnpm --filter api db:seed
pnpm seed:rules
```

---

## Technology Choices — What and Why

### pnpm workspaces (monorepo)

A **monorepo** means all three packages (`shared`, `api`, `web`) live in the same git repo. pnpm's workspace feature lets them reference each other with `workspace:*` in `package.json`.

**Why:** The `shared` package defines TypeScript types that both the API and web app use (e.g., what a login response looks like). If they were in separate repos, keeping those types in sync would be tedious. In a monorepo, one change updates both.

### Express.js (API)

Express is a minimal Node.js web framework. You define routes (URL + HTTP method → handler function) and middleware (functions that run before every request, like auth checking).

**Why:** It's the most widely understood Node.js framework. Very little magic — you can read the code and understand exactly what's happening.

### Drizzle ORM (database access)

Drizzle lets you write database queries in TypeScript instead of raw SQL. The TypeScript types are automatically derived from your schema, so if you query a column that doesn't exist, TypeScript catches it at compile time.

```typescript
// This is Drizzle — looks like SQL, is actually TypeScript
const rows = await db
  .select({ amount: transactions.amount, date: transactions.date })
  .from(transactions)
  .where(eq(transactions.userId, userId))
  .orderBy(desc(transactions.date));
```

**Why:** Better than raw SQL (type safety) but less magic than Prisma (you control the queries).

### PostgreSQL

A relational database. Data is stored in tables with rows and columns. Tables relate to each other via foreign keys (e.g., every transaction row has an `account_id` that points to a row in the `accounts` table).

**Why:** This data is inherently relational — a transaction belongs to an account, an account belongs to a user, a transaction has a category. Relational databases handle this naturally. Running in Docker so it doesn't pollute your machine.

### React + Vite (frontend)

React is a UI library where you build components (reusable pieces of UI). Vite is the build tool that compiles your TypeScript/TSX into browser-compatible JavaScript and runs a dev server with hot reload.

**Why React:** Component model fits well — `LoginPage`, `TransactionsPage`, `ProtectedRoute` are all self-contained. **Why Vite:** Fast. `pnpm --filter web dev` starts in under a second.

### React Query (`@tanstack/react-query`)

A library for managing server data in React. You define a query (a function that fetches data), and React Query handles caching, background refetching, loading/error states, and deduplication.

```typescript
// Without React Query: you'd manually manage isLoading, error, data state
// With React Query:
const { data, isLoading, isError } = useQuery({
  queryKey: ['transactions', page],
  queryFn: () => api.get('/transactions?page=' + page),
});
```

**Why:** The alternative is `useEffect` + `useState` for every API call, which gets messy fast.

### React Router

Handles URL-based navigation in a single-page app. When the URL is `/login`, React renders `<LoginPage>`. When it's `/`, it renders `<TransactionsPage>` (if authenticated).

**Why:** Without a router, the whole app is one "page" and the browser back button doesn't work.

### Tailwind CSS

Instead of writing CSS files, you apply utility classes directly to HTML elements:

```tsx
<button className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800">
  Sign in
</button>
```

`px-4` = `padding-left: 1rem; padding-right: 1rem`, `bg-gray-900` = dark background, etc.

**Why:** Fast to write, consistent, and the styles live right next to the HTML they style.

### JWT (JSON Web Tokens)

A JWT is a token that encodes a JSON payload (like `{ userId: "abc123", email: "you@example.com" }`) and signs it with a secret key. Anyone with the secret can verify that the token was created by the server and hasn't been tampered with.

```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.signature
    header (base64)     payload (base64)       signature
```

**Why:** Stateless authentication — the server doesn't need to look up the user in the DB on every request. It just verifies the signature.

---

## The Database

All 13 tables were defined upfront in `apps/api/src/db/schema.ts`. Here's what each one does:

### Auth tables

**`users`** — one row per registered user.
```
id (UUID) | email (unique) | password_hash | created_at
```
The password is never stored in plain text — it's hashed with bcrypt before storage.

**`refresh_tokens`** — one row per active login session.
```
id | user_id → users | token_hash (SHA-256 of the JWT) | expires_at
```
When you log in, a refresh token JWT is issued and its hash is stored here. When you log out, the row is deleted. When you refresh, the old row is deleted and a new one is inserted (rotation).

### Account + import tables

**`accounts`** — your bank accounts.
```
id | user_id → users | name | type (chequing/savings/credit/...) | institution (cibc/td/amex/questrade) | is_credit | currency
```
The `institution` field determines which CSV adapter is used when you upload a file for this account.

**`imports`** — one row per file upload.
```
id | account_id → accounts | filename | status | imported_count | duplicate_count | error_count
```
Tracks what happened during each import.

**`transactions`** — one row per financial transaction.
```
id | account_id → accounts | date | raw_description | source_name | amount | currency
   | category_id → categories | subcategory_id → categories | need_want | flagged_for_review
   | composite_key (unique) | import_id → imports
```
`composite_key` is a hash of (account_id + date + amount + description) used for deduplication — uploading the same file twice won't create duplicates.

### Category tables

**`categories`** — the category tree.
```
id | user_id (null = system category) | parent_id → categories (null = top-level) | name | is_income | icon
```
System categories (`user_id IS NULL`) are seeded by `pnpm --filter api db:seed`. Example tree:
```
Food (parent)
  ├── Groceries
  ├── Eating Out
  ├── Delivery
  └── Coffee
Transport (parent)
  ├── Gas
  ├── Parking
  └── Transit
```

**`categorization_rules`** — keyword → category mappings.
```
id | user_id (null = system rule) | keyword | source_name | category_id | subcategory_id | need_want | priority
```
System rules (`user_id IS NULL`) are seeded by `pnpm seed:rules`. When a transaction is imported, its description is checked against all rules (sorted by priority, highest first). The first match wins.

### Investment tables

These are populated by the Questrade adapter and not yet used in the UI:

**`investment_transactions`** — buy/sell/dividend activity.
**`investment_snapshots`** — point-in-time balance snapshots (Phase 2).
**`contribution_records`** — TFSA/RRSP/FHSA contribution room (Phase 2).

---

## The API — Every Endpoint Explained

Base URL: `http://localhost:3001/api/v1`

### Auth endpoints

**`POST /auth/register`**
```json
// Request body
{ "email": "you@example.com", "password": "yourpassword" }

// Response (201)
{ "accessToken": "eyJ...", "user": { "id": "uuid", "email": "you@example.com" } }
// Also sets: HttpOnly cookie with refresh token
```

**`POST /auth/login`** — same as register but for existing users. Returns 401 if email/password wrong.

**`POST /auth/refresh`** — sends the refresh token cookie, gets back a new access token.
```json
// Response (200)
{ "accessToken": "eyJ..." }
```

**`POST /auth/logout`** — sends the refresh token cookie, deletes it server-side.
```
Response: 204 No Content
```

### Account endpoints (all require `Authorization: Bearer <token>`)

**`GET /accounts`** — list your accounts.

**`POST /accounts`** — create an account.
```json
{ "name": "CIBC Chequing", "type": "chequing", "institution": "cibc" }
```

**`GET /accounts/:id`** — get one account.

### Import endpoint (requires auth)

**`POST /imports/upload`**

Accepts a `multipart/form-data` request with:
- `file` — the CSV file
- `accountId` — which account this belongs to

```bash
curl -X POST http://localhost:3001/api/v1/imports/upload \
  -H "Authorization: Bearer <token>" \
  -F "accountId=<account-uuid>" \
  -F "file=@/path/to/statement.csv"
```

```json
// Response (201)
{ "importedCount": 47, "duplicateCount": 3, "errorCount": 0 }
```

### Transaction endpoints (requires auth)

**`GET /transactions`** — paginated, filterable list.

Query parameters:
| Parameter | Example | What it does |
|-----------|---------|--------------|
| `page` | `?page=2` | Which page (default: 1) |
| `limit` | `?limit=50` | Per page (default: 20) |
| `account_id` | `?account_id=uuid` | Filter to one account |
| `start_date` | `?start_date=2025-01-01` | Transactions on or after this date |
| `end_date` | `?end_date=2025-03-31` | Transactions on or before this date |
| `category_id` | `?category_id=uuid` | Filter to one category |
| `flagged` | `?flagged=true` | Only show transactions flagged for review |

```json
// Response (200)
{
  "data": [
    {
      "id": "uuid",
      "date": "2025-06-14",
      "description": "LCBO/RAO #0025",
      "sourceName": "LCBO",
      "amount": "-59.00",
      "currency": "CAD",
      "categoryName": "Food",
      "accountName": "Amex Gold",
      "flaggedForReview": false,
      "needWant": "Want"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 47, "totalPages": 3 }
}
```

### Categories endpoint (requires auth)

**`GET /categories`** — full category tree with nested subcategories.
```json
[
  {
    "id": "uuid",
    "name": "Food",
    "isIncome": false,
    "icon": null,
    "userId": null,
    "subcategories": [
      { "id": "uuid", "name": "Groceries", "isIncome": false, "icon": null, "userId": null },
      { "id": "uuid", "name": "Eating Out", ... }
    ]
  }
]
```

---

## How Auth Works

### The two-token system

Every user gets two tokens when they log in:

| Token | Lifespan | Where it goes |
|-------|----------|---------------|
| **Access token** | 15 minutes | Response body → stored in `localStorage` |
| **Refresh token** | 7 days | `HttpOnly` cookie (browser handles it automatically) |

For every API request, the web app adds: `Authorization: Bearer <access_token>`.

When the access token expires (15 min), the web app can call `POST /auth/refresh` and the browser automatically sends the refresh token cookie. The server validates it, rotates it (deletes old, issues new), and returns a fresh access token.

### Why store the access token in localStorage?

Trade-off: `localStorage` is accessible to JavaScript (XSS risk), but using it means the token survives page refreshes. The app accepts this trade-off because:
1. The access token only lives 15 minutes
2. The risk of XSS in a personal local-use app is low

The refresh token, which is much more dangerous because it lasts 7 days, is stored in an `HttpOnly` cookie that JavaScript **cannot** read.

### How the frontend handles auth state

`AuthContext.tsx` provides global auth state to the whole app:

```tsx
// Any component can access this
const { user, isAuthenticated, login, logout } = useAuth();
```

On app load, `AuthContext` checks `localStorage` for a saved token and restores the session automatically. The `login(token, user)` function saves to `localStorage` and updates React state. `logout()` clears both.

### How routes are protected

`ProtectedRoute` wraps any route that requires login:

```tsx
<Route path="/"
  element={
    <ProtectedRoute>      ← if not logged in, redirect to /login
      <TransactionsPage />
    </ProtectedRoute>
  }
/>
```

---

## How CSV Imports Work

When you upload a CSV file, this pipeline runs:

```
Upload (multipart/form-data)
       ↓
   [multer middleware]
   Reads file into memory buffer
       ↓
   [imports.routes.ts]
   Validate: file present? accountId present?
       ↓
   [registry.ts]
   Look up which adapter matches this account's institution
       ↓
   [parser.ts: parseCsv()]
   Split the raw bytes into rows of string arrays
   Handle quoted fields, different line endings, etc.
       ↓
   [adapter.parse(rows, accountId)]
   Convert raw rows into normalised ParsedRow objects
   Each adapter knows its bank's column layout
       ↓
   [pipeline.ts: categorize()]
   For each row: match against categorization rules
   Find the highest-priority rule whose keyword appears in the description
   If no match: assign Uncategorized, set flaggedForReview = true
       ↓
   [import.service.ts]
   For each row: compute compositeKey (hash of date+amount+description+accountId)
   Try to INSERT; if compositeKey already exists → mark as duplicate (not an error)
   Record counts: imported / duplicate / error
       ↓
   Return summary to caller
```

### The four bank adapters

Each bank exports CSVs differently. These adapters handle the differences:

**Amex** (`amex.adapter.ts`)
- Has a header row: `Date,Date Processed,Description,Amount`
- Amounts are positive for charges (unusual) — the adapter negates them
- Date format: `15-Jun-25` → needs conversion to `2025-06-15`

**CIBC** (`cibc.adapter.ts`)
- No header row
- 5 columns: date, description, debit, credit, card number
- Debit column = money out (stored as negative), credit column = money in (positive)
- Card number in col[4] is used to detect this bank's format

**TD** (`td.adapter.ts`)
- No header row
- 5 columns: date, description, debit, credit, balance
- Column[4] is the running balance — ignored
- Same debit/credit convention as CIBC

**Questrade** (`questrade.adapter.ts`)
- XLSX file (not CSV) — uses the `xlsx` library to parse
- Columns: date, action, symbol, quantity, price, commission, net amount
- Action codes like `DIV` (dividend), `TF6` (TFSA contribution), `Buy`, `Sell`
- Creates rows in `investment_transactions`, not regular `transactions`

### How the adapter is chosen

`registry.ts` has two functions:
1. `getAdapterByInstitution(institution)` — direct lookup by account's institution field (e.g., `'cibc'` → CIBC adapter)
2. `detectAdapter(rows)` — looks at the file's content and guesses the bank based on column patterns (used if institution is unknown)

---

## How Categorization Works

### The rules engine

Every imported transaction runs through `categorize()` in `pipeline.ts`:

1. Load all rules where `user_id IS NULL` (system rules) sorted by `priority DESC`
2. Normalize the transaction description: lowercase, trim extra spaces, replace special characters
3. For each rule: check if `normalizedDescription.includes(rule.keyword)`
4. The first match (highest priority) wins → assign that rule's `categoryId`, `subcategoryId`, `needWant`
5. If no rule matches → assign the "Uncategorized" category, set `flaggedForReview = true`

### Example

Transaction description: `LCBO/RAO #0025 DUNDAS`
1. Normalized: `lcbo/rao #0025 dundas`
2. Rules checked in priority order...
3. Rule: `{ keyword: 'lcbo', categoryId: Food, subcategoryId: Alcohol, needWant: 'Want' }` ← matches
4. Transaction gets `category: Food`, `subcategory: Alcohol`, `needWant: Want`, `flaggedForReview: false`

### The ADD sentinel

Rules with `needWant: 'ADD'` are special — they match e-transfers and other transactions that always need manual review. When matched, these set `flaggedForReview = true` even though they did match a rule. This is for transactions that could be anything (an e-transfer to a friend could be rent, a gift, splitting a bill…).

### The seed script

`scripts/seed-rules.ts` inserts ~55 system rules covering common Canadian merchants. It's idempotent — running it twice won't create duplicates (it checks if a rule with the same keyword already exists first).

```bash
pnpm seed:rules    # Run once after a fresh DB setup
```

### The `needWant` field

Every transaction ends up with one of:
- `Need` — necessary expense (groceries, gas, pharmacy)
- `Want` — discretionary (restaurants, Steam, Amazon)
- `NA` — neutral/income (paycheque, transfers, bank fees)
- `ADD` — flagged e-transfers, needs manual review

This field is the foundation for the budget analysis in Phase 2.

---

## The Web App

### How pages are wired together

`main.tsx` wraps the whole app in two providers:
- `QueryClientProvider` — makes React Query work everywhere
- `BrowserRouter` — enables URL-based routing

`App.tsx` defines the routes:

```tsx
<AuthProvider>           ← makes auth state available everywhere
  <Routes>
    <Route path="/login"    element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/"         element={
      <ProtectedRoute>     ← redirects to /login if not logged in
        <TransactionsPage />
      </ProtectedRoute>
    } />
    <Route path="*"         element={<Navigate to="/" />} />
  </Routes>
</AuthProvider>
```

### How API calls are made

All API calls go through `lib/api.ts`:

```typescript
const api = axios.create({
  baseURL: 'http://localhost:3001/api/v1',
});

// This interceptor runs before every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

This means every component just calls `api.get('/transactions')` and the token is automatically attached. No need to pass tokens around.

### The hooks

`useTransactions` and `useCategories` are custom React hooks that wrap React Query:

```typescript
// In any component:
const { data, isLoading, isError } = useTransactions({ page: 1 });
// data?.data = array of transactions
// data?.pagination = { total, page, totalPages, ... }
```

React Query caches the result. If two components call `useTransactions({ page: 1 })`, only one HTTP request is made.

### The TransactionsPage

The main page. Shows:
- Header with your email and a Sign Out button
- A count of total transactions
- A table: date, description, category, account, amount
- Pagination controls (if > 20 transactions)
- Yellow highlight on rows with `flaggedForReview: true`
- Need/Want badges on categorized rows

Sign Out calls `POST /auth/logout`, then clears localStorage and redirects to `/login`.

---

## Testing

All tests live in `apps/api/src/`. There are two kinds:

### Unit tests (adapter tests)

These test pure functions with no database. They give the adapter some fake CSV rows and check the output:

```typescript
// From amex.adapter.test.ts
it('negates all amounts', () => {
  const rows = [['15-Jun-25', '15-Jun-25', 'STARBUCKS', '5.50']];
  const result = amexAdapter.parse(rows, accountId);
  expect(result[0].amount).toBe(-5.50);  // positive in CSV → negative stored
});
```

### Integration tests (routes tests)

These spin up the full Express app and hit real API endpoints against a real database:

```typescript
it('imports all CIBC rows correctly', async () => {
  const token = await registerAndLogin();     // hits POST /auth/register
  const accountId = await createAccount(token); // hits POST /accounts
  const res = await uploadCibc(token, accountId); // hits POST /imports/upload

  expect(res.status).toBe(201);
  expect(res.body.importedCount).toBe(4);
});
```

### Running tests

```bash
pnpm --filter api test           # run all tests once
pnpm --filter api test -- --watch  # re-run on file changes
```

### Why `fileParallelism: false`

All integration tests share the same Postgres database. Each test's `beforeEach` deletes all rows and starts fresh. If tests ran in parallel, one test's `beforeEach` would delete data that another test was about to read. Setting `fileParallelism: false` makes test files run one at a time.

**Current test count: 54 tests passing.**

| File | Tests | What it covers |
|------|-------|----------------|
| `auth.routes.test.ts` | 8 | Register, login, refresh, logout, token expiry |
| `accounts.routes.test.ts` | 7 | Create, list, get accounts |
| `imports.routes.test.ts` | 6 | Amex CSV upload, deduplication, error cases |
| `transactions.routes.test.ts` | 9 | Pagination, filters, auth |
| `cibc-import.routes.test.ts` | 3 | CIBC end-to-end import |
| `td-import.routes.test.ts` | 3 | TD end-to-end import |
| `amex.adapter.test.ts` | 4 | Amex parsing logic |
| `cibc.adapter.test.ts` | 5 | CIBC parsing logic |
| `td.adapter.test.ts` | 4 | TD parsing logic |
| `questrade.adapter.test.ts` | 5 | Questrade XLSX parsing |

---

## Useful Commands Reference

```bash
# ── Development ───────────────────────────────────────────────────────────────

# Start everything (API :3001 + web :5173)
pnpm dev

# Start only API
pnpm --filter api dev

# Start only web
pnpm --filter web dev

# ── Code Quality ──────────────────────────────────────────────────────────────

# Type-check all packages (0 errors = clean)
pnpm typecheck

# Lint all packages
pnpm lint

# ── Tests ─────────────────────────────────────────────────────────────────────

# Run all tests once
pnpm --filter api test

# Run tests in watch mode (re-runs on save)
pnpm --filter api test -- --watch

# Run a single test file
pnpm --filter api test src/routes/cibc-import.routes.test.ts

# ── Database ──────────────────────────────────────────────────────────────────

# Apply pending migrations
pnpm db:migrate

# Open Drizzle Studio (visual DB browser at localhost:4983)
pnpm db:studio

# Seed system categories
pnpm --filter api db:seed

# Seed categorization rules
pnpm seed:rules

# ── Docker ────────────────────────────────────────────────────────────────────

# Start Postgres
docker compose up postgres -d

# Stop Postgres (keep data)
docker compose down

# Stop Postgres and DELETE all data
docker compose down -v

# ── Manual API calls ──────────────────────────────────────────────────────────

# Register a user and get an access token
curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123"}' | jq -r '.accessToken'

# Create an Amex account (replace TOKEN with the token above)
curl -s -X POST http://localhost:3001/api/v1/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name":"Amex Gold","type":"credit","institution":"amex","isCredit":true}' | jq .

# Upload a CSV (replace ACCOUNT_ID and TOKEN)
curl -s -X POST http://localhost:3001/api/v1/imports/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "accountId=ACCOUNT_ID" \
  -F "file=@/path/to/statement.csv" | jq .

# List transactions
curl -s "http://localhost:3001/api/v1/transactions" \
  -H "Authorization: Bearer TOKEN" | jq '.data | length'

# ── Database inspection ───────────────────────────────────────────────────────

# See all tables
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d finance_dev -c "\dt"

# See all system categories
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d finance_dev \
  -c "SELECT name, parent_id IS NULL AS is_top_level FROM categories WHERE user_id IS NULL ORDER BY name;"

# See seeded rules
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d finance_dev \
  -c "SELECT keyword, source_name, need_want FROM categorization_rules WHERE user_id IS NULL ORDER BY priority DESC, keyword LIMIT 20;"

# Count transactions by category
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d finance_dev \
  -c "SELECT c.name, COUNT(t.id) FROM transactions t LEFT JOIN categories c ON c.id = t.category_id GROUP BY c.name ORDER BY count DESC;"
```

---

## Concepts Glossary

**JWT (JSON Web Token)** — A compact, signed token encoding a JSON payload. The server signs it with a secret; anyone with the secret can verify it was issued by the server. Used here for auth — the API issues JWTs on login and every protected route verifies them.

**Bearer token** — The convention for passing a JWT in an HTTP request: `Authorization: Bearer eyJ...`. "Bearer" means "whoever holds this token has the associated permissions."

**HttpOnly cookie** — A cookie the browser stores and automatically sends with requests, but which JavaScript cannot read (`document.cookie` won't show it). Used for the refresh token so it can't be stolen by XSS.

**bcrypt** — A password hashing algorithm designed to be slow (to resist brute-force attacks). Passwords are never stored in plain text — only their bcrypt hash. When you log in, bcrypt re-hashes your input and compares it to the stored hash.

**ORM (Object-Relational Mapper)** — A library that translates between TypeScript objects and database rows so you don't have to write raw SQL. Drizzle is the ORM used here.

**Migration** — A SQL file that describes a change to the database schema (add a table, add a column, etc.). Run in order, they build up the full schema. Never edit the DB directly — always use migrations so the schema stays reproducible.

**Monorepo** — A single git repository that contains multiple packages. Here: `packages/shared`, `apps/api`, and `apps/web` are all in the same repo and can reference each other.

**Middleware** — Functions in Express that run before a route handler. `requireAuth` is middleware — it runs before any protected route and either calls `next()` (let the request through) or returns `401 Unauthorized`.

**React Query** — A library for fetching and caching server data in React. Handles loading/error states and re-fetches stale data automatically.

**React Context** — A way to share state across many React components without passing it as props through every level. `AuthContext` uses this — any component anywhere in the tree can call `useAuth()` to get the current user.

**Composite key** — A unique identifier computed from multiple fields. Here: `hash(accountId + date + amount + description)`. Used to detect duplicate transactions — if you upload the same CSV twice, the second upload finds existing composite keys and skips those rows instead of creating duplicates.

**Foreign key** — A column in one table that points to the primary key of another table. For example, `transactions.account_id` is a foreign key to `accounts.id`. The database enforces that you can't create a transaction pointing to an account that doesn't exist, and you can't delete an account that has transactions (unless you set `ON DELETE CASCADE`).

**Seed** — A script that pre-populates the database with initial data. The categories seed inserts the 19 system categories. The rules seed inserts the merchant → category mappings. Seeds are idempotent (safe to run multiple times).

**Adapter pattern** — A design pattern where a common interface wraps different implementations. Here, each bank has its own adapter class, but they all implement the same `CsvAdapter` interface (`parse(rows, accountId): ParsedRow[]`). The import service doesn't care which bank it is — it just calls `adapter.parse()`.

**Hot reload / HMR** — When you save a file during `pnpm dev`, the browser automatically reflects the change without a full page refresh. Vite's dev server provides this for the web app.