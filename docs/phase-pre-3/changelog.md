Here's a summary of what was implemented:

Backend (4 files changed):

accounts.services.ts — listAccounts now accepts { includeInactive }, plus updateAccount, deactivateAccount, reactivateAccount
accounts.routes.ts — GET /accounts?includeInactive=true support; enum strings now pulled from @finance/shared
accounts-mutation.routes.ts — new file with PATCH /:id, PATCH /:id/deactivate, PATCH /:id/reactivate
app.ts — mutation router mounted alongside accounts router
Shared (1 file):

constants.ts — ACCOUNT_TYPES, ACCOUNT_TYPE_ORDER, INSTITUTIONS and their types exported
Frontend (8 files changed/created):

queryKeys.ts — accountKeys.allWithInactive
useAccounts.ts — useAllAccounts hook; Account interface typed with AccountType/Institution
useAccountMutations.ts — useCreateAccount, useUpdateAccount, useDeactivateAccount, useReactivateAccount
NavBar.tsx — Accounts link added
App.tsx — /accounts protected route
AccountForm.tsx — reusable form for create/edit
AccountEditPanel.tsx — slide-in panel matching TransactionReviewPanel pattern
AccountsPage.tsx — full page with sorted table, row-expansion panels, deactivate/reactivate
---
All three fixes are now complete:

constants.ts — PASSWORD_MAX: 100 added to FIELD_LIMITS
schemas/auth.ts — both .min() and .max() use FIELD_LIMITS values and template literal messages
src/index.ts — export * from './constants' added directly; types/index.ts no longer re-exports constants
---
Deleted

App.tsx — route tree replaces it
ProtectedRoute.tsx — replaced by beforeLoad guards
Created

router.tsx — route tree, typed context, requireAuth guard, transactionsSearchSchema (zod), module augmentation for full type inference
Modified

main.tsx — BrowserRouter removed; AuthProvider moved here as outer wrapper; RouterWrapper reads useAuth() and syncs auth state into router context via router.update; ErrorBoundary moved here too
instrument.ts — reactRouterV6BrowserTracingIntegration replaced with browserTracingIntegration()
NavBar.tsx — useLocation removed; active link state via activeProps/activeOptions on TanStack Router Link
AuthForm.tsx — imports and navigate() call updated
TransactionsPage.tsx — useState for filters/page replaced with useSearch({ from: '/' }); filter changes navigate to update URL search params
---
Installed: react-hook-form + @hookform/resolvers in apps/web

Input and Select — wrapped with React.forwardRef so RHF's register ref reaches the DOM element

packages/shared/src/schemas/accounts.ts — new schema (accountFormSchema / AccountFormInput) exported from the shared index, giving the same source-of-truth treatment as loginSchema/registerSchema

AuthForm — replaced two useState fields with useForm({ resolver: zodResolver(...) }), resolver switches on mode. Inline errors now come from formState.errors via FormField's error prop. Server errors stay in a separate useState. Removed required/minLength HTML attributes.

AccountForm — replaced five useState fields with useForm. The currency field uses setValueAs to preserve the .toUpperCase() transform. AccountFormState export kept unchanged so AccountEditPanel needs no edits.

TransactionTagsPanel — the tag creation <form> now uses useForm with a local tagSchema. Color remains a plain useState (button-driven, not a real input). On cancel, reset() clears the field.
---
All five issues are fixed. Here's a summary of what changed:

Issue	Fix
AccountFormState duplicate type	Replaced interface AccountFormState with export type AccountFormState = AccountFormInput
maxLength removed from tag input	Restored maxLength={FIELD_LIMITS.TAG_NAME_MAX} alongside {...register('name')}
API not using shared schema	accounts.routes.ts now uses accountFormSchema from shared; local createAccountSchema removed
Magic 100 in accountFormSchema	Added ACCOUNT_NAME_MAX: 100 to FIELD_LIMITS; both accountFormSchema and patchAccountSchema reference it
tagSchema local vs shared	Moved to packages/shared/src/schemas/tags.ts (tagFormSchema / TagFormInput), exported from shared index
The test payloads for account creation were also updated to send currency and isCredit explicitly, since accountFormSchema requires both (no more .default(DEFAULT_CURRENCY)).
---
Phase 1 — Foundation

Installed class-variance-authority, clsx, tailwind-merge, lucide-react, sonner, all Radix primitives, and @tanstack/react-table
Created lib/utils.ts (cn()) and components.json
Updated tailwind.config.js with shadcn CSS-variable color keys alongside existing tokens
Added CSS variable definitions to index.css mapped from the existing hex values — one token system, not two
Phase 2 — shadcn components
New files in components/ui/: dialog.tsx, tabs.tsx, dropdown-menu.tsx, sonner.tsx, tooltip.tsx, skeleton.tsx. All custom components (Button, Badge, Input, etc.) kept as-is.

Phase 3 — TanStack Table
TransactionsTable.tsx fully rewritten with typed ColumnDef[], sort state on Date/Description/Amount, column visibility toggle via DropdownMenu, and a ⋯ row actions menu (Review for flagged rows, stubbed Duplicate). Existing Tailwind classes and review panel expansion preserved.

Phase 4 — Toast system
toastMessages.ts centralises all strings. All mutations in useTransactionMutations.ts, useAccountMutations.ts, and useTags.ts now fire success/error toasts. <Toaster /> added to main.tsx.

Phase 5 — Dialog
AccountsPage.tsx — Deactivate button now opens a confirmation Dialog with the account name, Cancel, and Deactivate actions.

Phase 6 — Config page
ConfigPage.tsx with Tabs (Categories shows live data from useCategories(), Rules and Preferences are stubs). Route and nav link wired in router.tsx and NavBar.tsx.

Phase 7 — Skeletons
Transactions page shows a skeleton table grid on load; accounts page shows skeleton rows matching the table structure.

Phase 8 — ErrorBoundary
ErrorBoundary.tsx is a class component with styled error UI, wrapping RouterWrapper inside Sentry's boundary.
---
Here's a summary of everything that was done:

New files created:

AmountCell.tsx — Presentational component that parses amount once, applies color logic and formatting from the same num. formatAmount now takes a number instead of a string, consolidating all parse calls.
useTransactionColumns.tsx — All column definitions, wrapped in useMemo([reviewingId, onReviewToggle]). Also exports ACTIONS_COLUMN_ID (the magic string) and isTransactionReviewable (the shared predicate).
ColumnVisibilityToggle.tsx — Self-contained column visibility toolbar. Uses ACTIONS_COLUMN_ID from the hook rather than a raw string.
Modified files:

useTransactions.ts — PaginationInfo extracted and exported; TransactionsTable now imports it directly instead of declaring a duplicate subset.
TransactionsTable.tsx — Down to ~100 lines. isTransactionReviewable called once per row (fixes the dual-computation bug). visibleColumnCount wrapped in useMemo. UNKNOWN_PAGE_COUNT = -1 named constant. Redundant description cell wrapper <div> removed.
Deferred to docs/todo/transactions-table.md:

+$0.00 formatting for zero amounts (needs a display decision)
Stale reviewingId when changing pages (parent concern, needs a design call)
NaN guard on parseFloat(amount) (depends on whether you want a runtime guard or a branded type)
---
main.tsx — Added TooltipProvider wrapping the app so Radix tooltips work globally.
TransactionTagsPanel.tsx — Each tag badge now truncates its name text at max-w-[10ch] with ellipsis, and wraps in a Tooltip that shows the full name on hover. The × button gets shrink-0 so it's never squeezed out.
useTransactionColumns.tsx — Tags column tdClassName gains max-w-xs as a safety cap, so even many badges wrapping across lines won't push the column beyond a reasonable width.
---
RouterWrapper moved to RouterWrapper.tsx and imported in main.tsx
Non-null assertion replaced with an explicit null check that throws a descriptive error
---
Shared (packages/shared):

constants.ts — added ISO_DATE_REGEX
schemas/transactions.ts — added createTransactionSchema + CreateTransactionInput type
API (apps/api):

src/lib/constants.ts — removed ISO_DATE_REGEX
5 files updated to import ISO_DATE_REGEX from @finance/shared instead of @/lib/constants
Web (apps/web):

lib/toastMessages.ts — added TRANSACTION_CREATED / TRANSACTION_CREATE_FAILED
hooks/useTransactionMutations.ts — added useCreateTransaction()
components/panels/ManualTransactionPanel.tsx — new: fixed right-side panel with RHF form, all fields, tag chip selector, resets after submit, stays open
TransactionsPage.tsx — added panel state, "Add Transaction" button, handleDuplicate, renders ManualTransactionPanel
TransactionsTable.tsx — threads onDuplicate through to columns hook
useTransactionColumns.tsx — onDuplicate prop enabled, Duplicate menu item now functional
---
New files

useTagSelection.ts — owns selectedTagIds state and toggleTag/resetTags, extracted from the panel
useSubmitManualTransaction.ts — owns the two-step create + attach flow; calls api.post directly for tag attachment so a single invalidateQueries fires after Promise.all instead of one per tag; tracks isAttachingTags so isSubmitting covers the full submission window
packages/shared/src/schemas/transactions.ts

Added .superRefine cross-field check: subcategoryId present without categoryId is now a validation error, surfaced on the subcategoryId field
ManualTransactionPanel.tsx

InitialValues exported so consumers can use it as a named type
Replaced nested Controller/Controller for category+subcategory with two useController calls at the top of the component — the CategorySelect now receives values and handlers directly
Hardcoded '#6B7280' → DEFAULT_TAG_COLOR constant
allTags && allTags.length > 0 → allTags?.length ? ... : null
reset() and resetTags() now only run when submit returns true — tags are preserved so the user can retry if tag attachment fails
today moved from module scope into defaultValues so it's computed fresh on each mount
useState, useAttachTag, useCreateTransaction removed; useController added
TransactionsPage.tsx

panelInitialValues state now typed as InitialValues directly
handleReviewToggle and handleDuplicate wrapped in useCallback — prevents useMemo in useTransactionColumns from busting on every parent render
parseFloat(tx.amount) → Number(tx.amount) — avoids the silent empty-input NaN from parseFloat(''); note: description limit using NOTE_MAX is intentional, matching the API schema