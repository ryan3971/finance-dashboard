# Phase 2A — Learning Reference
## AI Categorization · Transfer Detection · Transaction Mutations · Tags · Manual Entry

This document explains what was built in Phase 2A, why each piece exists, and how to run and test it. It is written for someone learning as they go.

---

## Table of Contents
1. [What Phase 2A Added](#1-what-phase-2a-added)
2. [How to Run the Project](#2-how-to-run-the-project)
3. [How to Run Tests](#3-how-to-run-tests)
4. [AI Categorization — How It Works](#4-ai-categorization--how-it-works)
5. [Transfer Detection — How It Works](#5-transfer-detection--how-it-works)
6. [Transaction Mutations — PATCH & Manual Entry](#6-transaction-mutations--patch--manual-entry)
7. [Tags System](#7-tags-system)
8. [The Questrade Integration](#8-the-questrade-integration)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [API Endpoints Cheat Sheet](#10-api-endpoints-cheat-sheet)
11. [File Map — What Each File Does](#11-file-map--what-each-file-does)
12. [Key Patterns Used in This Codebase](#12-key-patterns-used-in-this-codebase)

---

## 1. What Phase 2A Added

Phase 1 built the skeleton: user auth, accounts, CSV/XLSX import, a rules-based categorization engine, and a read-only transactions list. Every transaction that didn't match a rule landed in "Uncategorized" and was flagged for review.

Phase 2A completes the backend so the UI (Phase 2B) has something real to work with:

| Feature | What it does |
|---|---|
| **AI categorization** | When the rules engine can't match a transaction, it calls an AI model (Claude Haiku or GPT-4o-mini) to make a best guess. Feature-flagged so you can keep it off during development. |
| **Transfer detection** | After every import, the system looks for transactions that are likely transfers between your own accounts (e.g., moving money from chequing to savings). These get flagged so they're excluded from income/expense totals. |
| **PATCH transactions** | Lets you manually override the category the rules engine or AI assigned. Can optionally save your correction as a new rule so future similar transactions get categorized automatically. |
| **Manual entry** | Lets you add a transaction that didn't come from a CSV (e.g., a cash payment). |
| **Tags** | User-defined labels (like "Ottawa Trip" or "Tax Deductible") you can attach to any transaction. Multiple tags per transaction are supported. |
| **Questrade import** | The Questrade brokerage XLSX format was fully wired up in Phase 1 but had no end-to-end test. Phase 2A adds that test. |

---

## 2. How to Run the Project

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL running on port **5434** (see below)
- Two databases: `finance_dev` (manual testing) and `finance_test` (automated tests)

### Start PostgreSQL
If you're using Docker:
```bash
docker run -d \
  --name finance-pg \
  -e POSTGRES_PASSWORD=postgres \
  -p 5434:5432 \
  postgres:16
```
Then create the two databases:
```bash
psql -h localhost -p 5434 -U postgres -c "CREATE DATABASE finance_dev;"
psql -h localhost -p 5434 -U postgres -c "CREATE DATABASE finance_test;"
```

### Set up environment variables
Copy the example file and fill in your values:
```bash
cp .env.example apps/api/.env
```
The minimum you need to run locally (with AI off):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/finance_dev
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5434/finance_test
JWT_SECRET=any-32-character-string-here-xxxx
JWT_REFRESH_SECRET=different-32-character-string-xx
ENABLE_AI_CATEGORIZATION=false
```

### Run migrations and seed
```bash
pnpm --filter api db:migrate   # creates tables
pnpm --filter api db:seed      # inserts system categories (Food, Housing, etc.)
```

### Start the API
```bash
pnpm --filter api dev
# API runs at http://localhost:3001
```

### Start the frontend (if built)
```bash
pnpm --filter web dev
# UI runs at http://localhost:5173
```

---

## 3. How to Run Tests

Tests use a real database (`finance_test`) — they are integration tests, not mocks. Each test file cleans up after itself by deleting all rows at the start of `beforeEach`.

```bash
# Run all API tests
pnpm --filter api test

# Run a specific test file
pnpm --filter api test src/routes/tags.routes.test.ts

# Run tests in watch mode (re-runs on file save)
pnpm --filter api test --watch

# Run typecheck (TypeScript error check, no compilation)
pnpm --filter api typecheck
```

**Expected output:** 65 tests passing across 14 test files.

> Note: You will see some error-level log lines in the test output. These are intentional — certain unit tests for the AI providers deliberately trigger the error path to verify the function returns `null` gracefully. The tests pass; the logs are just noise.

---

## 4. AI Categorization — How It Works

### The Problem It Solves
The rules engine works great for known merchants ("tim hortons" → Food/Coffee). But the first time you see a new merchant, there's no rule for it. Without AI, it goes straight to Uncategorized. With AI, the model reads the transaction description and makes an educated guess.

### The Pipeline (3 steps)
Every transaction goes through this sequence in `pipeline.ts`:

```
Import a transaction
       │
       ▼
[Step 1] Rules Engine ──── match found? ──► return result (fast, free, deterministic)
       │
       │ no match
       ▼
[Step 2] AI Provider ──── enabled? ─── no ──► skip
       │                        │
       │                       yes
       │                        ▼
       │               Call Claude Haiku or GPT-4o-mini
       │               Parse JSON response
       │               Confidence ≥ 0.70? ──── no ──► skip (return null)
       │                        │
       │                       yes
       │                        ▼
       │               return result (category_source: 'ai')
       │
       │ AI disabled or returned null
       ▼
[Step 3] Fallback ──► Uncategorized, flagged_for_review: true
```

### Feature Flag
The AI step is controlled by an environment variable:
```env
ENABLE_AI_CATEGORIZATION=false   # off (default, no API costs)
ENABLE_AI_CATEGORIZATION=true    # on
```

This is read **every time a transaction is categorized** (not once at startup), so you can change it without restarting the server.

### Choosing a Provider
```env
AI_PROVIDER=anthropic   # uses Claude Haiku (default, recommended)
AI_PROVIDER=openai      # uses GPT-4o-mini
```

### What the AI Is Asked
Both providers use the exact same prompt, built in `provider-utils.ts`. The prompt tells the model:
- The transaction description, amount, and currency
- The full list of your categories and subcategories
- Rules: income/transfers get `need_want: NA`, expenses get `Need` or `Want`
- To respond with a JSON object only (no markdown)

Example prompt output to the model:
```
You are a personal finance categorization assistant for a Canadian user.

Categorize the following bank transaction:
- Description: "tim hortons #1234"
- Amount: -4.25 CAD
- Type: expense/debit

Available categories and subcategories:
Food (Groceries, Eating Out, Coffee)
Housing (Rent, Utilities, Maintenance)
...

Respond with a JSON object only:
{
  "category": "Food",
  "subcategory": "Coffee",
  "need_want": "Want",
  "confidence": 0.95,
  "reasoning": "Tim Hortons is a coffee chain"
}
```

### Confidence Threshold
If the model isn't sure, it returns a lower confidence score. If the score is below `AI_CONFIDENCE_THRESHOLD` (default `0.70`), the result is discarded and the transaction falls through to Uncategorized. This prevents bad guesses from polluting your data.

### Key Files
| File | Role |
|---|---|
| `services/categorization/pipeline.ts` | Orchestrates the 3-step pipeline |
| `services/categorization/provider-utils.ts` | Shared prompt building and category resolution |
| `services/categorization/anthropic-provider.ts` | Calls Anthropic's API |
| `services/categorization/openai-provider.ts` | Calls OpenAI's API |

---

## 5. Transfer Detection — How It Works

### The Problem It Solves
When you move money from your chequing account to your savings account, two transactions appear in your data: a debit from chequing and a credit to savings. If you count both in your totals, your income and expenses will be wrong. Transfer detection finds these pairs and flags them so they can be excluded.

### How Detection Works
After every import, `detectTransfers()` in `transfer-detection.service.ts` scans the newly imported transactions using two strategies:

**Strategy 1 — Description keyword matching**
If the description contains words like `e-transfer`, `tfr-to`, `interac`, `transfer`, etc., it's a candidate.

**Strategy 2 — Amount pair matching**
If another transaction in a *different* account has the exact inverse amount (e.g., `-500.00` paired with `+500.00`) within a time window (default: 3 days before or after), it's a candidate.

The two strategies combine to give a confidence level:
| Match | Confidence | Action |
|---|---|---|
| Both description AND amount pair | High | Flag both transactions for review |
| Description only | Medium | Flag for review |
| Amount pair only | Low | Flag for review |

Flagged transactions show up in the UI for you to either **confirm** (mark as a real transfer) or **dismiss** (mark as a coincidence).

### Confirming and Dismissing
```bash
# Confirm a transfer pair — links both transactions
POST /api/v1/transfers/confirm
{ "transactionId": "uuid-A", "pairedTransactionId": "uuid-B" }

# Confirm single (only one side known)
POST /api/v1/transfers/confirm
{ "transactionId": "uuid-A" }

# Dismiss — clear the flag without marking as transfer
POST /api/v1/transfers/dismiss
{ "transactionId": "uuid-A" }
```

Once confirmed, `is_transfer: true` is set on the transaction and it will be excluded from income/expense calculations.

### Configuring the Time Window
```env
TRANSFER_DETECTION_WINDOW_DAYS=3   # look 3 days before/after for a matching amount
```

---

## 6. Transaction Mutations — PATCH & Manual Entry

### Overriding a Category
The AI or rules engine won't always get it right. `PATCH /api/v1/transactions/:id` lets you correct the category:

```bash
curl -X PATCH http://localhost:3001/api/v1/transactions/TRANSACTION-UUID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "CATEGORY-UUID",
    "subcategoryId": "SUBCATEGORY-UUID",
    "needWant": "Want",
    "note": "Annual work conference"
  }'
```

All fields are optional — only send what you want to change.

### Creating a Rule from a Correction
If you set `"createRule": true`, your correction is saved as a new categorization rule. The next time a transaction with a similar description is imported, it will be categorized automatically without needing AI or manual review:

```json
{
  "categoryId": "CATEGORY-UUID",
  "needWant": "Want",
  "createRule": true
}
```

The rule uses the first 40 characters of the transaction description as its keyword.

### Adding a Transaction Manually
For cash payments or transactions that don't appear in any bank export:

```bash
curl -X POST http://localhost:3001/api/v1/transactions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "ACCOUNT-UUID",
    "date": "2026-01-15",
    "description": "Cash - Coffee",
    "amount": -4.50,
    "currency": "CAD",
    "categoryId": "CATEGORY-UUID",
    "needWant": "Want"
  }'
```

- If you don't provide `categoryId`, the transaction is flagged for review
- `isIncome` is inferred from the sign of `amount` if not provided
- A `compositeKey` is built automatically for deduplication (so re-submitting the same transaction won't create a duplicate)

---

## 7. Tags System

Tags are user-defined labels — free-form text with an optional hex colour. They're separate from categories. A transaction can have a category ("Food / Coffee") and also multiple tags ("Ottawa Trip", "Expense Report").

### Creating and Managing Tags
```bash
# Create a tag
POST /api/v1/tags
{ "name": "Ottawa Trip", "color": "#3B82F6" }

# List all your tags
GET /api/v1/tags

# Delete a tag (automatically detaches from all transactions)
DELETE /api/v1/tags/TAG-UUID
```

### Attaching Tags to Transactions
```bash
# Attach
POST /api/v1/transactions/TRANSACTION-UUID/tags
{ "tagId": "TAG-UUID" }

# Detach
DELETE /api/v1/transactions/TRANSACTION-UUID/tags/TAG-UUID
```

Attaching a tag that's already attached does nothing (idempotent) — safe to call multiple times.

### Viewing Tags on Transactions
The `GET /api/v1/transactions` response includes a `tags` array on every transaction:
```json
{
  "id": "...",
  "description": "marriott hotels",
  "amount": "-189.00",
  "tags": [
    { "id": "uuid", "name": "Ottawa Trip", "color": "#3B82F6" },
    { "id": "uuid", "name": "Expense Report", "color": "#EF4444" }
  ]
}
```

### How Cascade Delete Works
The database has `ON DELETE CASCADE` on the `transaction_tags` join table. This means when you delete a tag, all the rows linking that tag to transactions are automatically deleted — no orphaned references.

---

## 8. The Questrade Integration

Questrade exports investment account activity as an XLSX file. Unlike bank CSVs (which record spending), Questrade files record investment events: dividends, buys, sells, transfers between accounts.

### Key Differences from Bank Imports
- Records go into the `investment_transactions` table, not `transactions`
- No categorization happens (these aren't spending events)
- Actions are mapped from raw Questrade codes to human-readable names:

| Questrade Code | Mapped Action |
|---|---|
| `DIV` | `dividend` |
| `BUY` | `buy` |
| `SELL` | `sell` |
| `TF6`, `TFE` | `transfer` |
| `DEP`, `CON` | `deposit` |
| `WDW` | `withdrawal` |
| `FCH` | `fee` |

### How to Import a Questrade File
```bash
curl -X POST http://localhost:3001/api/v1/imports/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/questrade-export.xlsx" \
  -F "accountId=YOUR-TFSA-ACCOUNT-UUID"
```

The system detects the Questrade format automatically from the column headers — you don't need to specify it.

### Deduplication
If you upload the same file twice, the second upload returns `importedCount: 0, duplicateCount: N`. This works because each row gets a `compositeKey` (a hash of accountId + date + description + amount). The database rejects duplicates silently.

---

## 9. Environment Variables Reference

Located in `apps/api/.env`. Copy from `.env.example`.

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/finance_dev
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5434/finance_test

# Auth (generate with: openssl rand -hex 32)
JWT_SECRET=your-32-byte-hex-secret
JWT_REFRESH_SECRET=different-32-byte-hex-secret

# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173

# AI Categorization
ENABLE_AI_CATEGORIZATION=false        # true to enable, false to skip (saves money)
AI_PROVIDER=anthropic                 # 'anthropic' (default) or 'openai'
AI_CONFIDENCE_THRESHOLD=0.70          # discard AI results below this score
ANTHROPIC_API_KEY=sk-ant-...          # required if AI_PROVIDER=anthropic
OPENAI_API_KEY=sk-...                 # required if AI_PROVIDER=openai

# Transfer Detection
TRANSFER_DETECTION_WINDOW_DAYS=3      # how many days either side to look for matching amount
```

---

## 10. API Endpoints Cheat Sheet

All endpoints require `Authorization: Bearer YOUR_ACCESS_TOKEN` header.
Get a token by calling `POST /api/v1/auth/login`.

### Transactions
```
GET    /api/v1/transactions                     List (paginated, filterable)
PATCH  /api/v1/transactions/:id                 Update category/note/needWant
POST   /api/v1/transactions                     Create manual entry
POST   /api/v1/transactions/:id/tags            Attach tag
DELETE /api/v1/transactions/:id/tags/:tagId     Detach tag
```

Query params for `GET /transactions`:
- `account_id=uuid` — filter by account
- `start_date=2026-01-01` — filter from date
- `end_date=2026-03-31` — filter to date
- `category_id=uuid` — filter by category
- `flagged=true` — only flagged-for-review transactions
- `page=1&limit=50` — pagination (max limit: 200)

### Tags
```
GET    /api/v1/tags          List all your tags
POST   /api/v1/tags          Create a tag
DELETE /api/v1/tags/:id      Delete a tag (cascades)
```

### Transfers
```
POST   /api/v1/transfers/confirm    Confirm a transfer (pair or single)
POST   /api/v1/transfers/dismiss    Dismiss a transfer flag
```

### Imports
```
POST   /api/v1/imports/upload       Upload CSV or XLSX file
```

### Auth
```
POST   /api/v1/auth/register        Create account
POST   /api/v1/auth/login           Get access + refresh tokens
POST   /api/v1/auth/refresh         Refresh access token
POST   /api/v1/auth/logout          Invalidate refresh token
```

### Accounts & Categories
```
GET    /api/v1/accounts             List accounts
POST   /api/v1/accounts             Create account
GET    /api/v1/categories           List categories (system + yours)
POST   /api/v1/categories           Create custom category
```

---

## 11. File Map — What Each File Does

```
apps/api/src/
│
├── app.ts                              Express app factory — registers all routes
├── server.ts                           Entry point — starts the HTTP server
│
├── db/
│   ├── index.ts                        Drizzle ORM database connection
│   └── schema.ts                       All table definitions (the "source of truth" for DB shape)
│
├── middleware/
│   ├── auth.ts                         requireAuth — validates JWT, attaches req.user
│   ├── error.ts                        Global error handler (catches thrown errors from routes)
│   └── logger.ts                       Pino logger setup + httpLogger middleware
│
├── routes/
│   ├── auth.routes.ts                  Register, login, refresh, logout
│   ├── accounts.routes.ts              CRUD for bank/investment accounts
│   ├── categories.routes.ts            List and create categories
│   ├── imports.routes.ts               File upload endpoint → calls import service
│   ├── transactions.routes.ts          GET /transactions (read-only, with tags)
│   ├── transactions-mutation.routes.ts PATCH (edit), POST (manual), tag attach/detach ← NEW
│   ├── transfers.routes.ts             Confirm and dismiss transfer flags ← NEW
│   ├── tags.routes.ts                  CRUD for tags ← NEW
│   └── health.routes.ts                GET /health — liveness check
│
├── services/
│   ├── categorization/
│   │   ├── pipeline.ts                 3-step categorization pipeline (rules → AI → fallback)
│   │   ├── pipeline.types.ts           CategorizationResult type definition
│   │   ├── rules-engine.ts             Step 1: match transaction against saved rules
│   │   ├── provider-utils.ts           Shared: fetch categories, build prompt, resolve IDs ← NEW
│   │   ├── anthropic-provider.ts       Step 2a: call Claude Haiku ← NEW
│   │   └── openai-provider.ts          Step 2b: call GPT-4o-mini ← NEW
│   │
│   ├── imports/
│   │   ├── import.service.ts           Orchestrates file parsing, categorization, DB inserts
│   │   ├── registry.ts                 Maps institution names to adapter classes
│   │   ├── parser.ts                   Parses CSV and XLSX bytes into raw rows
│   │   ├── utils.ts                    buildCompositeKey and other helpers
│   │   └── adapters/
│   │       ├── amex.adapter.ts         American Express CSV format
│   │       ├── cibc.adapter.ts         CIBC CSV format
│   │       ├── td.adapter.ts           TD Bank CSV format
│   │       └── questrade.adapter.ts    Questrade XLSX format (investment transactions)
│   │
│   └── transfers/
│       └── transfer-detection.service.ts  Detects, confirms, dismisses transfers ← NEW
```

---

## 12. Key Patterns Used in This Codebase

### Pattern 1 — Feature flags via environment variables read at call time
```typescript
// BAD — evaluated once at module load, can't be changed without restart
const AI_ENABLED = process.env.ENABLE_AI_CATEGORIZATION === 'true';

// GOOD — evaluated on every call
const AI_ENABLED = () => process.env.ENABLE_AI_CATEGORIZATION === 'true';
```

### Pattern 2 — Lazy singleton clients (AI SDKs)
Rather than creating the Anthropic/OpenAI client at module load (which would fail if the API key isn't set), the client is created on first use:
```typescript
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}
```
This means the OpenAI SDK can be installed without needing an OpenAI API key unless you actually use it.

### Pattern 3 — Graceful fallthrough instead of throwing
AI provider functions never throw. If anything goes wrong (network error, bad JSON, unknown category name), they catch the error and return `null`. The pipeline interprets `null` as "try the next step":
```typescript
try {
  // ... call AI, parse response ...
  return result;
} catch (err) {
  logger.error({ err }, 'AI categorization failed — falling through');
  return null;  // pipeline moves to Step 3 (Uncategorized)
}
```

### Pattern 4 — Drizzle ORM for all database queries
SQL is never written as raw strings. Drizzle provides type-safe query building:
```typescript
// Select with a join
const rows = await db
  .select({ id: transactions.id, name: categories.name })
  .from(transactions)
  .innerJoin(categories, eq(transactions.categoryId, categories.id))
  .where(eq(transactions.accountId, accountId));
```

### Pattern 5 — Composite keys for deduplication
Every transaction gets a `compositeKey` — a string combining accountId, date, description, and amount. The database has a `UNIQUE` constraint on this column. If you try to insert a duplicate, the database rejects it:
```typescript
// In the import loop, duplicates are caught here:
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('duplicate') || message.includes('unique')) {
    result.duplicateCount++;
  }
}
```

### Pattern 6 — Route-level ownership checks
Before any mutation, the route verifies the resource belongs to the authenticated user. This prevents one user from editing another user's transactions:
```typescript
async function getOwnedTransaction(transactionId: string, userId: string) {
  const [txn] = await db
    .select(...)
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(
      eq(transactions.id, transactionId),
      eq(accounts.userId, userId)   // ← ownership check
    ))
    .limit(1);
  return txn ?? null;
}
```
If this returns `null`, the route responds with `404 Not Found` — intentionally not revealing whether the resource exists at all.
