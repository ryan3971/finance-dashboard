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