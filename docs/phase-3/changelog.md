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
