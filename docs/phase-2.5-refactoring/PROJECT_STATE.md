# Finance Dashboard — Project State (April 4, 2026)

## Overview

A full-stack **personal finance dashboard** monorepo. Users can import bank CSVs, auto-categorize transactions via rules or AI, detect inter-account transfers, and tag/review transactions.

**Tech Stack:**
- Monorepo: pnpm workspaces (Node >=20)
- API: Express 5.2 + Drizzle ORM + PostgreSQL
- Web: React 18 + Vite + TailwindCSS + TanStack Query
- Shared: Zod schemas + TypeScript types
- Testing: Vitest + supertest (backend); vitest infrastructure ready (frontend)
- Monitoring: Sentry (both apps)
- AI: Optional Anthropic Claude or OpenAI for categorization

**Repo status:** Clean, `main` branch. 81 backend tests, all passing.

---

## Monorepo Structure

```
finance-dashboard/
├── apps/
│   ├── api/         # Express REST API
│   └── web/         # React SPA
├── packages/
│   └── shared/      # Zod schemas, TS types, constants
└── package.json     # Root workspace
```

---

## API (`apps/api`)

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register user |
| POST | `/api/v1/auth/login` | Login → JWT + refresh cookie |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Revoke refresh token |
| GET | `/api/v1/accounts` | List user's accounts |
| POST | `/api/v1/accounts` | Create account |
| GET | `/api/v1/accounts/:id` | Get single account |
| GET | `/api/v1/transactions` | List transactions (filters + pagination) |
| POST | `/api/v1/transactions` | Create manual transaction |
| PATCH | `/api/v1/transactions/:id` | Update category/needWant/note/createRule |
| POST | `/api/v1/transactions/:id/tags` | Add tag to transaction |
| DELETE | `/api/v1/transactions/:id/tags/:tagId` | Remove tag from transaction |
| GET | `/api/v1/categories` | Get full category tree |
| POST | `/api/v1/imports/upload` | Upload + process CSV file |
| GET | `/api/v1/tags` | List user tags |
| POST | `/api/v1/tags` | Create tag |
| DELETE | `/api/v1/tags/:id` | Delete tag |
| POST | `/api/v1/transfers/confirm` | Confirm transfer pair |
| POST | `/api/v1/transfers/dismiss` | Dismiss false-positive transfer |
| GET | `/api/v1/health` | Health check |

**Transaction filters:** `accountId`, `startDate`, `endDate`, `categoryId`, `flagged`, `page`, `limit`

### Database Schema (`apps/api/src/db/schema.ts`)

| Table | Purpose |
|-------|---------|
| `users` | Auth (email, passwordHash) |
| `refresh_tokens` | JWT refresh token management |
| `accounts` | Financial accounts (type, institution, currency, isCredit) |
| `categories` | Hierarchical categories (parent_id, isIncome, icon) |
| `categorization_rules` | Keyword-based auto-categorization rules |
| `tags` | User-defined tags with hex color |
| `imports` | CSV import metadata and status |
| `transactions` | Core transactions (compositeKey for dedup, categorySource, needWant, isTransfer, flaggedForReview) |
| `transaction_tags` | Many-to-many join |
| `investment_transactions` | Stock/ETF trades (symbol, action, quantity, price, commission) |
| `investment_snapshots` | Account balance snapshots |
| `contribution_records` | TFSA/RRSP contribution tracking |
| `user_config` | User settings (emergencyFundTarget) |

Key fields on `transactions`:
- `compositeKey` (unique) — deduplication
- `categorySource` enum: `'rule' | 'ai' | 'manual' | 'default'`
- `categoryConfidence` (0–1) — AI confidence score
- `needWant` enum: `'Need' | 'Want' | 'NA'`
- `isTransfer` boolean

### Categorization Pipeline (`apps/api/src/pipelines/categorization/`)

Cascade order per transaction:
1. **Rules engine** — deterministic keyword match, priority-ordered, first match wins
2. **AI provider** (feature-flagged via `ENABLE_AI_CATEGORIZATION`)
   - Anthropic (`anthropic-provider.ts`) — Claude Haiku by default
   - OpenAI (`openai-provider.ts`) — alternative
   - Results below `AI_CONFIDENCE_THRESHOLD` (default 0.7) are rejected
3. **Fallback** — sets 'Uncategorized' + `flaggedForReview = true`

Auto-rule creation: when `PATCH /transactions/:id` is called with `createRule: true`, a rule is created from the transaction description.

### Transfer Detection Pipeline (`apps/api/src/pipelines/transfer-detection/`)

- Runs post-import on newly inserted transactions
- Matches on `TRANSFER_KEYWORDS` (e.g. 'e-transfer', 'interac', 'tfr-to') + inverse amount pairs within configurable window (default 3 days)
- Confidence levels:
  - **High** (keyword + amount match) → auto-confirmed
  - **Medium/Low** → flagged for user review
- User confirms via `POST /transfers/confirm` or dismisses via `POST /transfers/dismiss`

### Import Adapters (`apps/api/src/features/imports/adapters/`)

Auto-detects bank from CSV headers if account has no institution set.

| Adapter | File | Notes |
|---------|------|-------|
| CIBC | `cibc/cibc.adapter.ts` | |
| TD | `td/td.adapter.ts` | |
| Questrade | `questrade/questrade.adapter.ts` | Also parses investment transactions |
| Amex | `amex/amex.adapter.ts` | |
| Generic | `debit-credit.adapter.ts` | Fallback: Date, Description, Debit, Credit columns |

### Key Services

- **`auth.service.ts`** — register, login, refresh, logout
- **`accounts.service.ts`** — CRUD for accounts
- **`transactions.service.ts`** — list (with filters/pagination), patch, create, tag management
- **`categories.service.ts`** — `getCategoryTree(userId)` returns hierarchical structure
- **`tags.service.ts`** — list, create, delete
- **`import.service.ts`** — orchestrates CSV parse → dedup → categorization → transfer detection → ImportResult

---

## Web App (`apps/web`)

### Pages

| Page | File | Description |
|------|------|-------------|
| Login | `features/auth/LoginPage.tsx` | Email/password login |
| Register | `features/auth/RegisterPage.tsx` | Sign-up with password confirmation |
| Transactions | `features/transactions/TransactionsPage.tsx` | Main dashboard with filters, pagination, inline review |
| Import | `features/import/ImportPage.tsx` | CSV upload with result summary |

### UI Components (`components/ui/`)

Button, Input, Select, Badge (variants: default/warning/error), FormField, Pagination, CategorySelect, EmptyState, NavBar, PageLayout

### Feature Components

- `TransactionsTable` — paginated table with inline editing
- `TransactionFilters` — account, date range, category, flagged toggle
- `TransactionReviewPanel` — inline panel for reviewing/editing flagged transactions
- `TransactionTagsPanel` — add/remove tags
- `AuthForm` — shared login/register form
- `AuthProvider` — context for accessToken, user, login/logout
- `ProtectedRoute` — auth guard

### Custom Hooks (`hooks/`)

- `useAuth()` — auth context
- `useTransactions(filters, pagination)` — paginated transaction list
- `useAccounts()` — account list
- `useCategories()` — category tree (30min staleTime)
- `useTags()` — user tags
- `useTransactionMutations()` — patch, create, add/remove tags

### Lib (`lib/`)

- `api.ts` — axios instance with auth header + token refresh interceptor
- `queryKeys.ts` — React Query key factory
- `storageKeys.ts` — localStorage key constants
- `errors.ts` — error message parser
- `config.ts` — frontend config
- `instrument.ts` — Sentry init

---

## Shared Package (`packages/shared`)

**Exports:**

Types: `Transaction`, `NeedWant`, `ImportResult`, `PatchTransactionInput`, `RawTransaction`, `RawInvestmentTransaction`, `RegisterRequest`, `LoginRequest`, `AuthResponse`, `JwtPayload`

Zod Schemas: `registerSchema`, `loginSchema`, `userSchema`, `transactionSchema`, `needWantSchema`

Constants:
- `TRANSFER_KEYWORDS` — list of transfer-detection keywords
- `DEFAULT_CURRENCY` = `'CAD'`
- `FIELD_LIMITS` — `{NOTE_MAX: 500, TAG_NAME_MAX: 50, PASSWORD_MIN: 8}`
- `NEED_WANT_OPTIONS` = `['Need', 'Want', 'NA']`

---

## Tests

**81 tests passing across 15 files** (all backend; frontend infra ready but no test files yet).

| File | Tests |
|------|-------|
| `accounts.routes.test.ts` | 10 |
| `auth.routes.test.ts` | 8 |
| `transactions.routes.test.ts` | 9 |
| `categories.routes.test.ts` | 5 |
| `imports.routes.test.ts` | 6 |
| `cibc-import.routes.test.ts` | 3 |
| `td-import.routes.test.ts` | 3 |
| `questrade-import.routes.test.ts` | 6 |
| `amex.adapter.test.ts` | 4 |
| `cibc.adapter.test.ts` | 6 |
| `questrade.adapter.test.ts` | 8 |
| `td.adapter.test.ts` | 4 |
| `anthropic-provider.test.ts` | 3 |
| `openai-provider.test.ts` | 2 |
| `transfer-detection.test.ts` | 4 |

Test infrastructure: Vitest + supertest, separate test DB, seed helpers in `testing/setup.ts` and `testing/test-helpers.ts`.

---

## Environment Variables

```
# Required
DATABASE_URL            # PostgreSQL connection (dev)
DATABASE_URL_TEST       # PostgreSQL connection (test)
JWT_SECRET              # 32-byte hex
JWT_REFRESH_SECRET      # 32-byte hex (separate)
CORS_ORIGIN             # Default: http://localhost:5173

# Optional
PORT                    # Default: 3001
NODE_ENV                # development | test | production
LOG_LEVEL               # info | debug | warn | error
ENABLE_AI_CATEGORIZATION  # Default: false
AI_PROVIDER             # anthropic | openai
AI_CONFIDENCE_THRESHOLD # Default: 0.7
ANTHROPIC_API_KEY
OPENAI_API_KEY
TRANSFER_DETECTION_WINDOW_DAYS  # Default: 3
AWS_REGION              # Default: ca-central-1 (Phase 4, S3)
S3_BUCKET_NAME          # Phase 4, S3
```

---

## Notable Implementation Details

- **JWT auth** with httpOnly refresh token cookies (7-day window)
- **Deduplication** via `compositeKey` — safe to re-import CSVs
- **Hierarchical categories** — system categories + user-defined subcategories
- **Multi-bank import** with auto-detection from CSV headers
- **Pino logger** with multi-stream + file output
- **Sentry** on both API and web
- **Pre-commit hooks** via Husky + lint-staged (ESLint, `max-warnings=0`)

---

## Recent Work (last ~10 commits)

1. Major refactor — consolidated React components/styles, type definitions, removed magic values, enforced DRY
2. Transaction route query params renamed to camelCase
3. Sentry integration added to both frontend and backend
4. Logger enhanced with multi-stream + file output
5. Variable naming consistency pass (snake_case → camelCase)
6. Rules type definitions refactored in import and categorization services

---

## Known TODOs / Not Yet Built

- **S3 upload** — scaffold in place (filename + s3Key columns) but buffer not yet uploaded (Phase 4)
- **Frontend tests** — vitest infrastructure exists but no test files written
- **Investment UI** — schema exists (`investment_transactions`, `investment_snapshots`, `contribution_records`) but no frontend pages or API routes beyond schema
- **User config UI** — `user_config` table exists but no endpoints or UI
- **Dashboard/analytics page** — no summary/charts page yet; only raw transaction list
