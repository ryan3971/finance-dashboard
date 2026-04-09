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