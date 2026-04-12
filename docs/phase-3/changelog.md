API (all under apps/api/src/features/dashboards/anticipated-budget/)

Schema: two new tables (anticipated_budget, anticipated_budget_months) with relations, migration applied to both dev and test DBs
Service: listEntries (batch fetches overrides, resolves all 12 months per entry), createEntry, updateEntry, deleteEntry, upsertMonthOverride, deleteMonthOverride
Routes: GET /api/v1/anticipated-budget?year=YYYY, POST, PATCH /:id, DELETE /:id, POST /:id/months/:month, DELETE /:id/months/:month
22 integration tests — all passing
Shared (packages/shared/src/)

schemas/anticipated-budget.ts — create/update/upsert Zod schemas
types/anticipated-budget.ts — AnticipatedBudgetEntry, AnticipatedBudgetMonth, AnticipatedBudgetResponse
BUDGET_ENTRY_NAME_MAX added to FIELD_LIMITS
Web (apps/web/src/features/anticipated-budget/)

hooks/useAnticipatedBudget.ts — year-scoped query
hooks/useAnticipatedBudgetMutations.ts — create, update, delete, upsert/delete month override
components/SummaryCards.tsx — monthly and annual income/expense/net (computed client-side)
components/MonthChips.tsx — 12 chips per entry, default vs override styled, inline edit on click
components/AnticipatedBudgetEntryCard.tsx — collapsible card with year total
components/AddEntryDialog.tsx — RHF + Zod form, income/expense toggle, need/want segmented control
AnticipatedBudgetPage.tsx — year selector, income/expense sections, empty state, summary cards
Route at /anticipated-budget, "Budget" nav link added

---

anticipated-budget-item.routes.ts (renamed from anticipated-budget-mutation.routes.ts)

Replaced monthParamSchema with monthRouteParamsSchema = idParamsSchema.extend({ month: ... }) — single parse of req.params in both month handlers
POST /:id/months/:month → PUT /:id/months/:month
deleteMonthOverride result is now checked: returns 404 { error: 'Month override not found' } if the row didn't exist
app.ts

Import path: anticipated-budget-mutation.routes → anticipated-budget-item.routes
Variable: anticipatedBudgetMutationRouter → anticipatedBudgetItemRouter
useAnticipatedBudgetMutations.ts

api.post(...) → api.put(...) for the upsert month override mutation
anticipated-budget.routes.test.ts

Describe block title updated to PUT /api/v1/anticipated-budget/:id/months/:month
All 7 .post(...) calls on the months sub-route updated to .put(...)

---

utils.ts — new file with shared MONTH_LABELS and fmt
DeleteEntryDialog.tsx — new confirmation dialog matching the DeactivateAccountDialog pattern
AnticipatedBudgetEntryCard.tsx — imports fmt from utils, delete button now opens DeleteEntryDialog instead of firing immediately, monthlyAmount !== null explicit check, commented-out entryId line removed
SummaryCards.tsx — local fmt and monthNames removed, replaced with imports from utils
MonthChips.tsx — local MONTH_LABELS removed, replaced with import from utils

---

Backend

Migration 0003 adds needs_percentage, wants_percentage, investments_percentage to user_config
PATCH /api/v1/user-config now accepts and persists allocation percentages (validated to sum to 100)
GET /api/v1/dashboard/income?year=YYYY returns 12 months with totals and Needs/Wants/Investments targets
Shared

UserConfig type extended with 3 percentage fields
New IncomeDashboardResponse type (dashboard.ts)
New updateUserConfigSchema with sum-to-100 refine validation
dashboardKeys query key factory added to web queryKeys.ts
Frontend

/dashboard/income — income page with year selector, 12-month table, allocation breakdown, annual summary, and a no-config banner linking to Preferences
Config → Preferences — form to set Needs/Wants/Investments %, with running sum display (turns green at 100)
"Income" link added to NavBar
Tests

7 unit tests for buildIncomeResponse — all pass
Integration tests for the route (auth, validation, 12-month response structure all pass)

---

user-config.service.ts

upsertUserConfig helper (private) — replaces the old select-then-insert pattern with an atomic INSERT ... ON CONFLICT DO UPDATE using EXCLUDED.user_id as a no-op set. Always returns the row in a single round trip, no race condition.
getUserConfig — now a thin wrapper over upsertUserConfig.
updateUserConfig — calls upsertUserConfig and keeps the result. Guards with Object.keys(patch).length === 0 to return the existing row immediately if input.allocations is undefined, skipping the update entirely.
configColumns — explicit column selection shared by both .returning() calls.
income.service.ts

monthExpr variable — extracts the EXTRACT(MONTH FROM ...) SQL fragment so select and groupBy reference the same expression rather than duplicating it.
Decimal arithmetic — replaces Number(total) + .toFixed(2) with decimal.js. needs and wants are rounded to 2 decimal places via .toDecimalPlaces(2) (half-up, the default). investments is derived as amount.minus(needs).minus(wants), guaranteeing the three components always sum exactly to total.
amount.isZero() guard — replaces the amount === 0 check cleanly in the Decimal world.

---

income.service.ts — AllocationPercentages is now internal-only; new exported IncomePercentageConfig interface with nullable fields; buildIncomeResponse accepts it and owns the null-check
income.routes.ts — percentages block removed; config passed directly to buildIncomeResponse
income.service.test.ts — noPercentages constant added; four null call sites replaced

---

Done. Summary of changes:

lib/utils.ts — fmt added here as the single source of truth
IncomePage.tsx — local definition removed, imports from @/lib/utils
anticipated-budget/utils/utils.ts — local fmt removed (only MONTH_LABELS remains)
SummaryCards.tsx — imports fmt from @/lib/utils, MONTH_LABELS still from ../utils/utils
AnticipatedBudgetEntryCard.tsx — imports fmt from @/lib/utils

---

@/lib/utils.ts — Added MONTH_LABELS as const export. The feature-level anticipated-budget/utils/utils.ts file was deleted.

MonthChips.tsx — Updated import to @/lib/utils.

SummaryCards.tsx — Updated import, added SummaryCard sub-component, replaced 6 repeated card shells with <SummaryCard label value colorClass /> calls. Also pre-computed monthLabel to avoid repeating the index expression three times.

YearSelector.tsx — New component in components/common/ accepting year and onChange props. Reusable across every year-scoped dashboard page.

IncomePage.tsx — Removed local MONTH_LABELS, removed formatAmount wrapper (inlined fmt(Number(...))), replaced inline year nav with <YearSelector>, and fixed allocationConfigured to use .some() — safe on an empty array and semantically correct.

PreferencesTab.tsx — Replaced the locally-duplicated schema with one derived from shared: the z.coerce.number() fields stay (needed for HTML inputs), and the sum-to-100 .refine is delegated to allocationsValidator.safeParse(v).success so there's a single source of truth. Replaced three watch('field') calls with one watch([...]) destructure.

## tsconfig.json — Added noUncheckedIndexedAccess: true. Array index accesses now return T | undefined, which will surface any future unsafe arr[i].prop patterns at compile time.

Shared types (packages/shared/src/types/)

dashboard.ts — IncomeMonthAllocation.needs/wants/investments and IncomeMonth.total: string → number
anticipated-budget.ts — AnticipatedBudgetMonth.amount: string → number; AnticipatedBudgetEntry.monthlyAmount: string | null → number | null
API service layer

income.service.ts — new Decimal() now always constructed (not just when percentages exist); .toFixed(2) replaced with .toNumber() for all response fields
anticipated-budget.service.ts — added Decimal import; removed ZERO_AMOUNT string constant; resolveMonths converts amounts via new Decimal().toNumber(); all three response-building sites convert monthlyAmount at the boundary
API tests — string assertions updated to numbers across all three test files

Web (apps/web/src/)

lib/utils.ts — added parseAmount(s) with NaN guard
IncomePage.tsx — pct accepts number, number; all Number()/parseFloat() removed
SummaryCards.tsx — parseFloat() removed from both reduce functions
AnticipatedBudgetEntryCard.tsx — parseFloat() removed from yearly total and monthly display
AmountCell.tsx — parseFloat → parseAmount
useTransactionColumns.tsx — parseFloat → parseAmount in sort function
TransactionsPage.tsx — Number(tx.amount) → parseAmount(tx.amount) for duplicate form init

---

snapshot.repository.ts (new)
All four DB query functions and the three row interfaces moved here. monthDateRange stays private to the repository — it's only used by the queries. Changes from the original:

queryCurrentMonthExpenses — added COALESCE around SUM to match queryCurrentMonthIncome; now consistent and safe if a join shape ever changes
All interfaces exported so the service can import them as parameter types
snapshot.service.ts (rewritten)
No DB imports, no getUserConfig — buildSnapshotResponse is now a pure function; all data arrives as parameters
getUserConfig cross-feature dependency removed — the route owns that call, same pattern as income.routes.ts
SnapshotConfig interface declared here and exported so the route can satisfy it with the getUserConfig return shape
No ! assertions — replaced hasAllocationConfig + ! with a narrowed percentages object ({ needs, wants, investments }); TypeScript narrows all three values together
income.isZero() separated from percentages === null — when config is set but there's no income, the response now returns explicit zeros rather than collapsing to the same state as "no config"
'chequing' magic string — replaced with const CHEQUING_ACCOUNT_TYPE = 'chequing' satisfies AccountType; the satisfies check fails at compile time if the value is ever removed from ACCOUNT_TYPES
ef prefixes — renamed to emergencyFundBalance, emergencyFundTarget, emergencyFundPercentage
Rounding comment added on the spendingNeeds/spendingWants block
snapshot.routes.ts (updated)
getUserConfig moved here from the service
All four query functions imported from the repository
Promise.all over all five fetches (unchanged parallelism)
year/month derived here from new Date() and passed into buildSnapshotResponse
---
Everything looks correct. The root cause was that in ESLint's flat config, rules are not merged across config objects — the last matching config for a given rule wins. The monorepo/cross-app-isolation block was defined after web/feature-boundaries and api/feature-boundaries, and since all three used import/no-restricted-paths, the monorepo block silently replaced the feature boundary zones for all apps/** files.

The fix:

web/feature-boundaries — added the web→api cross-app zone at the end of its zones array
api/feature-boundaries — added the api→web cross-app zone at the end of its zones array
monorepo/cross-app-isolation — renamed to monorepo/shared-pkg-isolation, narrowed files to packages/** only (no longer touches apps/**), retains only the packages/shared → apps restriction
---
Created src/hooks/useAccounts.ts — moved useAccounts, useAllAccounts, and the Account interface to the shared hooks layer (same as useCategories)
Deleted features/accounts/hooks/useAccounts.ts
Updated all 8 imports across: AccountsPage, AccountRow, AccountEditPanel, DeactivateAccountDialog, useAccountMutations, ManualTransactionPanel, TransactionFilters, and ImportPage to import from @/hooks/useAccounts