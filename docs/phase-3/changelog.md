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
