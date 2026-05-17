# Investments Feature Spec
**Version:** v1.0 — May 2026 **Author:** Ryan **Status:** Draft — Pre-implementation

---
## Implementation
**Chunk 1 — Schema migration** Section 6 only. Add `roomCarriedConfirmed` to `contributionRecords` in `schema.ts`, generate the migration, run it against dev and test DBs. No logic, no routes. Done when `drizzle-kit generate` produces a clean migration and both DBs are current.

---

**Chunk 2 — Shared package** Section 5 only. Add `types/investments.ts` and `schemas/investments.ts` to `packages/shared`. No app code touches these yet — this chunk just makes the types available for import. Done when `pnpm typecheck` passes across all workspaces.

---

**Chunk 3 — API: repository + service** Sections 4.1, 4.3, 4.4. Create the `features/investments/` directory with `investments.repository.ts`, `investments.service.ts`, and `investments.errors.ts`. No routes wired yet — this is pure query and business logic. Covers the paginated transaction fetch, the summary aggregation, the contribution room derivation, and the `roomCarried` TFSA estimate. Done when the service functions are callable and typed correctly. No test coverage yet — that comes in Chunk 5.

---

**Chunk 4 — API: routes** Sections 4.2, 4.5. Add `investments.routes.ts` and `investments-mutation.routes.ts`. Wire Zod validation using schemas from Chunk 2, call service functions from Chunk 3. Register both routers in `app.ts`. Done when all five endpoints exist and return correct shapes against manual testing (Bruno).

---

**Chunk 5 — API: tests + seed data** Sections 9 and 8. Write `investments.routes.test.ts` covering all cases in Section 9.1. Add the updated `investment-transaction.fixture.ts`. Add staging seeds (`investment-transactions.ts`, `contribution-records.ts`). Done when `pnpm --filter api test` is green.

---

**Chunk 6 — Web: hooks + query keys** Section 7.6 and the `investmentKeys` factory from Section 5.3. Add `investmentKeys` to `queryKeys.ts`. Add the three query hooks in `features/dashboards/investments/hooks/`. No components yet. Done when hooks compile and `pnpm typecheck` passes.

---

**Chunk 7 — Web: components + page** Sections 7.2–7.5, 7.7. Build all components, `InvestmentsPage`, route registration, and NavBar entry. Done when the page renders correctly with real data and all filter/pagination interactions work.

# Investments Feature Spec
**Version:** v2.0 — May 2026 **Author:** Ryan **Status:** Revised — Pre-implementation

---

## 1. Purpose & Scope
This document specifies the full investments feature for the Personal Finance Dashboard. It covers everything from the import pipeline (already partially complete) through to the dashboard UI.

The feature has three goals:
1. **Activity ledger** — a filterable, paginated table of investment transactions imported from Questrade CSV exports
2. **Contribution summary** — per-account tracking of annual contributions, withdrawals, and available room for registered accounts (TFSA, RRSP, FHSA)
3. **Activity summary cards** — aggregate stats for the selected period (dividends received, fees paid, net deposits)

**Explicitly out of scope for this build:**

- Current market value of holdings (requires external price data not available in Questrade CSVs)
- Portfolio allocation by holding
- Unrealized gains/losses
- `riskLevel` classification (deferred — schema column retained, no UI built)
- `investmentSnapshots` table (schema retained, no population path built)

---

## 2. What Already Exists
|Layer|Status|Notes|
|---|---|---|
|`investmentTransactions` schema|✅ Complete|All columns present, relations defined|
|`investmentSnapshots` schema|✅ Complete|Retained, not used in this build|
|`contributionRecords` schema|⚠️ Needs migration|See Section 6 — two columns dropped, two added|
|Questrade CSV adapter|✅ Complete|Parses all columns, maps action codes|
|Questrade import route + service|⚠️ Stub|Route and adapter implemented; integration test exists but is currently disabled (commented out, fixture missing from main branch)|
|`features/investments/` (API)|⬜ Stub|`.gitkeep` only|
|`features/dashboards/investments/` (web)|⬜ Stub|`.gitkeep` only|
|Shared types / schemas for investments|⬜ Missing|Nothing in `packages/shared`|
|Seed data|⬜ Missing|No staging investment transactions|

---

## 3. Data Model Decisions
### 3.1 `contributionRecords` — Population Model
`contributionRecords` tracks contribution room per account per tax year. The current schema has stored `contributions` and `withdrawals` columns — these are **dropped** in the Chunk 1 migration (see Section 6). They are replaced by live derivation from `investmentTransactions` at query time, which is always accurate and cannot go stale on manual transaction edits.

The fields after migration:

|Field|Type|Source|Notes|
|---|---|---|---|
|`annualLimit`|`numeric`, nullable|User-entered|CRA-provided; cannot be derived. Required for room calculation.|
|`roomCarried`|`numeric`, nullable|User-enterable, pre-populated for TFSA|See Section 3.2.|
|`roomCarriedConfirmed`|`boolean`, default false|Set true on explicit user save|Controls "Estimated" label in UI. Added in migration.|
|`contributions`|—|Derived at query time|Sum of `deposit` action rows in `investmentTransactions` for that account + year. Not stored.|
|`withdrawals`|—|Derived at query time|Sum of `withdrawal` action rows for that account + year. Not stored.|

A `contributionRecords` row only needs to exist when the user has entered an `annualLimit` or `roomCarried` value. If no record exists for an account + year, the summary still returns derived `contributions` and `withdrawals` but sets `annualLimit`, `roomCarried`, and `availableRoom` to null.

### 3.2 `roomCarried` — Pre-populated Estimate (TFSA only)
`roomCarried` is the contribution room carried into the tax year from prior years. It is user-enterable but the service pre-populates it with a derived estimate for TFSA accounts to reduce manual entry burden.

**Derivation formula (TFSA only, for year Y):**

```
roomCarried(Y) = annualLimit(Y-1) + roomCarried(Y-1) + withdrawals(Y-1) − contributions(Y-1)
```

Where `withdrawals(Y-1)` and `contributions(Y-1)` are derived live from `investmentTransactions`.

**Edge cases — both result in `roomCarried: null, roomCarriedIsEstimate: false`:**

- `annualLimit(Y-1)` is null (user has not entered it): skip the estimate entirely. A partial estimate that silently excludes the new room granted that year is worse than no estimate.
- No prior-year data exists at all (first year of data): same result. The user enters from scratch.

**RRSP and FHSA:** `roomCarried` is always user-entered for these account types. The accumulation rules are income-dependent and cannot be derived from transaction history. No estimate is pre-populated.

This derivation is an approximation for TFSA — it can drift from CRA's actual figure if transactions are missing or if there are CRA adjustments. The UI makes this explicit: the pre-populated value is labelled "Estimated" until the user confirms or overrides it. Once the user saves (any save action on that row), `roomCarriedConfirmed` is set to true and the label drops.

### 3.3 `riskLevel` — Deferred
The column exists in `investmentTransactions` and is always `null`. No UI is built for it in this release. Documented upgrade path: per-transaction user override (inline edit on the activity ledger), with account-level default setting.

---

## 4. API Layer
### 4.1 New Feature: `features/investments/`
This feature owns three concerns: the activity ledger, contribution records CRUD, and the dashboard summary endpoint. It does **not** own imports — those continue through `features/imports/`.

**File structure:**

```
features/investments/
  investments.routes.ts           # GET routes
  investments-mutation.routes.ts  # POST/PATCH/DELETE routes
  investments.service.ts
  investments.repository.ts       # Complex queries (mirrors snapshot pattern)
  investments.errors.ts
  investments.routes.test.ts
```

### 4.2 Endpoints
#### Activity Ledger
```
GET /api/v1/investments/transactions
```

**Query params:**

|Param|Type|Default|Notes|
|---|---|---|---|
|`accountId`|`uuid`|—|Filter by account. Optional — omit to return all investment accounts.|
|`action`|`string`|—|Filter by normalized action (`buy`, `sell`, `dividend`, `deposit`, `withdrawal`, `transfer`, `fee`).|
|`symbol`|`string`|—|Filter by ticker symbol. Case-insensitive.|
|`startDate`|`date`|—|Inclusive.|
|`endDate`|`date`|—|Inclusive.|
|`page`|`integer`|`1`||
|`pageSize`|`integer`|`50`|Max `200`.|

**Response shape:**

```typescript
{
  data: InvestmentTransactionRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface InvestmentTransactionRow {
  id: string;
  accountId: string;
  accountName: string;       // joined from accounts
  date: string;              // YYYY-MM-DD
  action: string;            // normalized
  rawAction: string;
  symbol: string | null;
  description: string | null;
  quantity: number | null;
  price: number | null;
  grossAmount: number | null;
  commission: number | null;
  amount: number;            // net amount
  currency: string;
  activityType: string | null;
  note: string | null;
}
```

**Auth:** `requireAuth`. All queries scoped by `userId` via account join — `userId` always sourced from `req.user`, never the client.

#### Activity Summary
```
GET /api/v1/investments/summary
```

**Query params:** `year` (required integer), `accountId` (optional uuid).

**Response shape:**

```typescript
interface InvestmentSummaryResponse {
  year: number;
  dividendsReceived: number;
  feesPaid: number;
  netDeposits: number;        // deposits − withdrawals
  totalContributions: number; // deposits only
  totalWithdrawals: number;
}
```

Derived entirely from `investmentTransactions`. No `contributionRecords` involved.

#### Contribution Room
```
GET /api/v1/investments/contribution-room
```

**Query params:** `year` (required integer).

Returns all registered accounts for the user (type in `tfsa`, `rrsp`, `fhsa`) with their contribution summary for the given year.

**Response shape:**

```typescript
interface ContributionRoomResponse {
  year: number;
  accounts: AccountContributionSummary[];
}

interface AccountContributionSummary {
  accountId: string;
  accountName: string;
  accountType: 'tfsa' | 'rrsp' | 'fhsa';
  annualLimit: number | null;          // null if not entered
  roomCarried: number | null;          // null if not entered / not estimable
  roomCarriedIsEstimate: boolean;      // true if pre-populated, not yet confirmed
  contributions: number;               // derived from investmentTransactions
  withdrawals: number;                 // derived from investmentTransactions
  availableRoom: number | null;        // null if annualLimit is null
  // availableRoom = annualLimit + (roomCarried ?? 0) + withdrawals − contributions
}
```

`availableRoom` is only computable when `annualLimit` is known. If the user has not entered an `annualLimit`, the endpoint still returns `contributions` and `withdrawals` but sets `annualLimit`, `roomCarried`, and `availableRoom` to null.

```
PUT /api/v1/investments/contribution-room/:accountId/:year
```

Upserts a `contributionRecords` row. Uses `onConflictDoUpdate` targeting the `(account_id, tax_year)` unique constraint added in the Chunk 1 migration.

**Request body:**

```typescript
{
  annualLimit?: number;
  roomCarried?: number;
  roomCarriedConfirmed?: boolean;  // set true when user explicitly saves roomCarried
}
```

**Auth + scoping:** Route validates that the `accountId` belongs to `req.user.id` before writing. Rejects non-registered account types with 400.

### 4.3 Service Layer Responsibilities
`investments.service.ts` handles:

- Filtering and pagination logic for the activity ledger
- Computing `availableRoom` from `annualLimit + (roomCarried ?? 0) + withdrawals − contributions`
- Pre-populating `roomCarried` estimate for TFSA accounts using prior-year data (only when both `annualLimit(Y-1)` is known and prior-year transaction data exists — see Section 3.2 edge cases)
- Applying the `roomCarriedIsEstimate` flag

`investments.repository.ts` owns the heavier queries:

- Paginated `investmentTransactions` fetch with account join and all filter params
- Contribution/withdrawal aggregation query (grouped by account + year, derived from `investmentTransactions`)
- The `roomCarried` TFSA derivation query (cross-year aggregation)
- The activity summary aggregation query

### 4.4 Errors File
```typescript
// investments.errors.ts
INVESTMENT_ACCOUNT_NOT_FOUND        // 404 — accountId doesn't belong to user
CONTRIBUTION_RECORD_NOT_FOUND       // 404
INVALID_ACCOUNT_TYPE_FOR_ROOM       // 400 — account type is not tfsa/rrsp/fhsa
```

### 4.5 App Registration
Mount in `app.ts`:

```typescript
app.use('/api/v1/investments', investmentsRouter);
app.use('/api/v1/investments', investmentsMutationRouter);
```

---

## 5. Shared Package (`packages/shared`)
### 5.1 New Types — `types/investments.ts`
```typescript
export type InvestmentAction =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'deposit'
  | 'withdrawal'
  | 'transfer'
  | 'fee';

export interface InvestmentTransactionRow { /* as Section 4.2 */ }
export interface InvestmentSummaryResponse { /* as Section 4.2 */ }
export interface AccountContributionSummary { /* as Section 4.2 */ }
export interface ContributionRoomResponse { /* as Section 4.2 */ }
```

### 5.2 New Schemas — `schemas/investments.ts`
```typescript
export const investmentTransactionFiltersSchema = z.object({
  accountId: z.string().uuid().optional(),
  action: z.enum([
    'buy', 'sell', 'dividend', 'deposit', 'withdrawal', 'transfer', 'fee'
  ]).optional(),
  symbol: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const investmentSummaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  accountId: z.string().uuid().optional(),
});

export const contributionRoomQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const upsertContributionRoomSchema = z.object({
  annualLimit: z.number().positive().optional(),
  roomCarried: z.number().optional(),
  roomCarriedConfirmed: z.boolean().optional(),
});
```

### 5.3 Query Keys — `lib/queryKeys.ts` (web)
Add `investmentKeys` factory:

```typescript
export const investmentKeys = {
  all: ['investments'] as const,
  transactions: (filters: InvestmentTransactionFilters) =>
    [...investmentKeys.all, 'transactions', filters] as const,
  summary: (year: number, accountId?: string) =>
    [...investmentKeys.all, 'summary', year, accountId] as const,
  contributionRoom: (year: number) =>
    [...investmentKeys.all, 'contribution-room', year] as const,
};
```

---

## 6. Database Migration
One migration required. Run `drizzle-kit generate` after all `schema.ts` changes below are applied, then run against dev and test DBs.

### `schema.ts` Changes
**`contributionRecords` table — update as follows:**

- Remove `contributions` column
- Remove `withdrawals` column
- Add `roomCarriedConfirmed: boolean('room_carried_confirmed').notNull().default(false)`
- Add unique constraint on `(accountId, taxYear)` — required for upsert conflict target

```typescript
export const contributionRecords = pgTable(
  'contribution_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .references(() => accounts.id)
      .notNull(),
    taxYear: integer('tax_year').notNull(),
    annualLimit: numeric('annual_limit', { precision: 12, scale: 2 }),
    roomCarried: numeric('room_carried', { precision: 12, scale: 2 }),
    roomCarriedConfirmed: boolean('room_carried_confirmed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.accountId, t.taxYear)]
);
```

### Generated Migration Will Include:
```sql
ALTER TABLE contribution_records
  DROP COLUMN contributions,
  DROP COLUMN withdrawals,
  ADD COLUMN room_carried_confirmed boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT contribution_records_account_id_tax_year_unique
    UNIQUE (account_id, tax_year);
```

---

## 7. Web Layer
### 7.1 Feature Structure
```
features/dashboards/investments/
  components/
    ActivitySummaryCards.tsx
    ContributionRoomCard.tsx
    ContributionRoomRow.tsx       # Inline-editable row within the card
    InvestmentTransactionsTable.tsx
    InvestmentFilters.tsx
    InvestmentSkeleton.tsx
  hooks/
    useInvestmentTransactions.ts
    useInvestmentSummary.ts
    useContributionRoom.ts
    useContributionRoomMutation.ts
  InvestmentsPage.tsx
```

### 7.2 Page Layout
```
┌─────────────────────────────────────────────┐
│  Investments  [Year selector]               │  ← page header
├──────────────┬──────────────┬───────────────┤
│  Dividends   │  Fees Paid   │  Net Deposits │  ← ActivitySummaryCards
│  $X,XXX      │  -$XX        │  $X,XXX       │
├─────────────────────────────────────────────┤
│  Contribution Room                          │  ← ContributionRoomCard
│  Account   Contributed  Limit  Available    │    (registered accounts only;
│  TFSA      $X,XXX       $7,000  $X,XXX ✏️  │     omitted if none exist)
│  RRSP      $X,XXX       —       —      ✏️  │
├─────────────────────────────────────────────┤
│  Activity  [account ▼] [action ▼] [symbol]  │  ← InvestmentFilters
│  ─────────────────────────────────────────  │
│  Date  Account  Action  Symbol  Qty  Amount │  ← InvestmentTransactionsTable
│  ...                                        │
│                          [pagination]        │
└─────────────────────────────────────────────┘
```

### 7.3 Activity Summary Cards
Three cards using the existing dashboard summary card pattern:

|Card|Value|Colour|
|---|---|---|
|Dividends Received|`dividendsReceived`|`text-positive`|
|Fees Paid|`feesPaid`|`text-danger`|
|Net Deposits|`netDeposits`|`text-content-primary` (neutral)|

Year selector drives all three queries. Default year = current year.

### 7.4 Contribution Room Card
Only renders if the user has at least one registered account (TFSA/RRSP/FHSA). Omitted entirely if not — non-registered accounts have no contribution room concept.

**Table columns:** Account name, Account type badge, Contributed (YTD), Withdrawn (YTD), Annual Limit, Room Carried, Available Room.

**Inline edit pattern:** Annual Limit and Room Carried cells are hover-reveal editable (same pattern as existing inline edits elsewhere in the app). Clicking the edit icon replaces the cell value with an input. Save fires `PUT /contribution-room/:accountId/:year`. On success, invalidate `investmentKeys.contributionRoom(year)`.

**States:**

- `annualLimit` is null → Annual Limit cell shows `—` with an "Add" prompt. Available Room shows `—`.
- `roomCarriedIsEstimate: true` → Room Carried value has an "Est." badge (`neutral` variant) and a tooltip: "Estimated from prior-year transactions. Save to confirm."
- `availableRoom` is negative → render in `text-danger`.

### 7.5 Investment Transactions Table
**Default visible columns:** Date, Account, Action, Symbol, Description, Amount. **Toggle-able columns:** Quantity, Price, Gross Amount, Commission, Currency, Activity Type.

**Action badge colour mapping:**

|Action|Badge variant|
|---|---|
|`buy`|`info`|
|`sell`|`accent`|
|`dividend`|`success`|
|`deposit`|`success`|
|`withdrawal`|`warning`|
|`transfer`|`neutral`|
|`fee`|`danger`|

**Amount column:** Always `font-mono`. Sign convention: deposits and dividends positive (`text-positive`), withdrawals and fees negative (`text-danger`), buys and sells neutral (`text-content-primary`). Use `AmountCell` logic.

**Symbol column:** Null renders as `—`. Present renders as `font-mono text-sm`.

**Filters:** Account dropdown (all investment accounts for the user), Action multiselect, Symbol text input (free text, debounced 300ms), Date range (start/end date inputs). Filter state lives in URL search params via TanStack Router — consistent with Transactions page.

**Pagination:** Default 50 rows. Uses existing `<Pagination>` component.

**Empty state:** "No investment transactions found." with hint "Import a Questrade CSV to get started."

### 7.6 Query Hooks
All three hooks follow the existing dashboard query pattern: `placeholderData: keepPreviousData`, `staleTime: 5 minutes`, `useDelayedPending` for skeleton gating, `isFetching` → `opacity-50` on the data wrapper.

```typescript
// useInvestmentTransactions.ts
// Key: investmentKeys.transactions(filters)
// Endpoint: GET /api/v1/investments/transactions
// Returns: { data: InvestmentTransactionRow[], pagination: PaginationMeta }

// useInvestmentSummary.ts
// Key: investmentKeys.summary(year, accountId)
// Endpoint: GET /api/v1/investments/summary?year=YYYY[&accountId=...]

// useContributionRoom.ts
// Key: investmentKeys.contributionRoom(year)
// Endpoint: GET /api/v1/investments/contribution-room?year=YYYY
```

### 7.7 Router Integration
Add to `router.tsx`:

```typescript
/investments  → InvestmentsPage (requireAuth guard, beforeLoad)
```

Add to `NavBar.tsx`: Investments is the last dashboard tab, after YTD. Do not reorder existing tabs.

---

## 8. Seed Data
### 8.1 Staging Seeds
Add to `db/seeds/staging/`:

**`investment-transactions.ts`** — ~30 realistic Questrade-style rows across a TFSA and RRSP account. Must cover all action types: `buy`, `sell`, `dividend`, `deposit`, `withdrawal`, `transfer`, `fee`. Span 2 calendar years (e.g. 2024 and 2025) to exercise the year selector and contribution room cross-year derivation.

**`contribution-records.ts`** — two rows:

- TFSA 2024: `annualLimit = 7000`, `roomCarried = 14500`, `roomCarriedConfirmed = true`
- RRSP 2024: `annualLimit = null` — exercises the "enter limit" prompt state

Verify that at least one TFSA and one RRSP account exist in the staging account seed before adding these rows. Add them if not.

### 8.2 Test Fixture
`testing/fixtures/investment-transaction.fixture.ts` uses the current schema's `$inferInsert` type and accepts `Partial<>` overrides. Before writing tests, verify it covers `buy`, `dividend`, `deposit`, and `withdrawal` action types as defaults or via override. If a convenience builder producing multiple rows covering all four action types would reduce test setup verbosity, add one alongside the existing fixture function — do not replace it.

---

## 9. Testing
### 9.1 Pre-condition: Questrade Import Test
Before writing `investments.routes.test.ts`, the Questrade import integration test must be in a runnable state:

- Confirm the CSV fixture exists at `src/features/imports/adapters/__fixtures__/questrade.csv`
- Uncomment `questrade-import.routes.test.ts`
- Confirm it passes (`pnpm --filter api vitest run src/features/imports/questrade-import.routes.test.ts`)

The investment route tests depend on having a clean data insertion path via import. If the import test cannot pass, resolve that first.

### 9.2 What to Test
Following the existing integration-only pattern against `finance_test`.

**Activity ledger:**

- Returns all investment transactions for the authenticated user's accounts
- `accountId` filter returns only matching rows
- `action` filter returns only matching action types
- `symbol` filter is case-insensitive
- Date range filters (startDate, endDate) are inclusive and work correctly
- Pagination: `page` and `pageSize` respected; `total` and `totalPages` correct
- Transactions belonging to another user's accounts are not returned

**Contribution room — GET:**

- Returns only registered account types (tfsa/rrsp/fhsa); non-registered accounts excluded
- Returns correct derived `contributions` and `withdrawals` from transaction data
- When no `contributionRecords` row exists: `annualLimit`, `roomCarried`, `availableRoom` are null; `contributions` and `withdrawals` are still present and correct
- When `annualLimit` is entered: `availableRoom` computes correctly (`annualLimit + (roomCarried ?? 0) + withdrawals − contributions`)
- TFSA `roomCarried` estimate pre-populated correctly from prior-year transactions when prior-year `annualLimit` is known
- TFSA `roomCarried` estimate is null when prior-year `annualLimit` is null (edge case — Section 3.2)
- TFSA `roomCarried` estimate is null when no prior-year data exists (edge case — Section 3.2)
- `roomCarriedIsEstimate: false` after `roomCarriedConfirmed` is set true

**Contribution room — PUT:**

- Upserts correctly on first write (no existing row)
- Upserts correctly on second write (existing row, update path)
- Returns 403 if `accountId` belongs to another user
- Returns 400 if account type is not tfsa/rrsp/fhsa
- Setting `roomCarriedConfirmed: true` persists and is reflected in subsequent GET

**Activity summary:**

- Aggregates dividends, fees, net deposits, totalContributions, totalWithdrawals correctly for the given year
- Optional `accountId` filter scopes correctly
- Returns zeros (not null) when no transactions exist for the year

---

## 10. Implementation Order (Chunks)
### Chunk 1 — Schema Migration
Update `schema.ts` per Section 6. Run `drizzle-kit generate`. Run migration against dev and test DBs (`pnpm db:migrate`, `pnpm --filter api db:migrate:test`). Done when both DBs are current and `pnpm typecheck` passes.

### Chunk 2 — Shared Package
Add `types/investments.ts` and `schemas/investments.ts` to `packages/shared` per Section 5.1 and 5.2. Add `investmentKeys` to `apps/web/src/lib/queryKeys.ts` per Section 5.3. No app code touches these yet. Done when `pnpm typecheck` passes across all workspaces.

### Chunk 3 — API: Repository + Service
Create `features/investments/` with `investments.repository.ts`, `investments.service.ts`, and `investments.errors.ts`. No routes yet. Covers paginated transaction fetch, summary aggregation, contribution room derivation, and TFSA `roomCarried` estimate logic. Done when service functions are callable and correctly typed.

### Chunk 4 — API: Routes
Add `investments.routes.ts` and `investments-mutation.routes.ts`. Wire Zod validation using schemas from Chunk 2. Call service functions from Chunk 3. Register in `app.ts`. Done when all five endpoints are reachable and manually verified via Bruno — including at least one round-trip that exercises `roomCarriedIsEstimate` toggling.

### Chunk 5 — API: Tests + Seed Data
First: confirm Questrade import test is runnable (Section 9.1). Then write `investments.routes.test.ts` per Section 9.2. Update `investment-transaction.fixture.ts` if needed (Section 8.2). Add staging seeds (Section 8.1). Done when `pnpm --filter api test` is green.

### Chunk 6 — Web: Hooks
Add three query hooks in `features/dashboards/investments/hooks/` per Section 7.6. No components yet. Done when hooks compile and `pnpm typecheck` passes.

### Chunk 7 — Web: Components + Page
Build all components, `InvestmentsPage`, route registration in `router.tsx`, and NavBar entry per Sections 7.2–7.5 and 7.7. Investments tab is last dashboard tab, after YTD. Done when the page renders correctly with real data and all filter, pagination, and inline-edit interactions work.

---

## 11. Deferred Items
|Item|Current state|Upgrade path|
|---|---|---|
|NavBar exact position|Last dashboard tab, after YTD|Confirmed — no further action needed|
|`riskLevel`|Schema column exists, always null|Per-transaction inline edit + account-level default|
|`investmentSnapshots`|Schema exists, no population path|Inject snapshot at import time from CSV net amount on settlement date|
|Multi-currency|`currency` column exists per row|All current data is CAD. No conversion logic. Add when a second currency appears.|
|Non-registered account contribution room|Excluded from UI|Correct by design — non-registered accounts have no contribution room concept|
|Questrade import integration test|Disabled — fixture missing from main branch|Resolve in Chunk 5 pre-condition before writing investment route tests|
