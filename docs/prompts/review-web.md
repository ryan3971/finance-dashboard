You are performing a comprehensive code review of the `apps/web` workspace of a React 18 SPA built with Vite, TanStack Router v1, TanStack Query, Tailwind CSS, shadcn/ui, React Hook Form, and Zod. The codebase is a personal finance dashboard.

## Codebase Structure

- `src/features/` — self-contained domain modules (accounts, anticipated-budget, auth, config, dashboards, import, transactions). No cross-feature imports allowed.
- `src/components/ui/` — shadcn/ui primitives (no app logic)
- `src/components/common/` — reusable app-aware components
- `src/components/layout/` — NavBar, PageLayout, RouterWrapper
- `src/hooks/` — cross-feature hooks (useAccounts, useCategories, useMediaQuery)
- `src/lib/` — api.ts (Axios instance), queryKeys.ts (React Query key factories), storageKeys.ts, utils.ts, errors.ts, toastMessages.ts
- `src/router.tsx` — TanStack Router tree, requireAuth guard, search param schemas

## Architecture Rules to Enforce

1. **No cross-feature imports** — features must be fully self-contained. A file in `features/transactions/` must never import from `features/accounts/`, etc.
2. **No barrel files** — no `index.ts` whose sole purpose is re-exporting. This includes inside feature folders.
3. **Dashboard queries must not re-aggregate** — client layer receives pre-aggregated totals from the API. No summing raw transaction arrays on the client.
4. **Query key factories** — all React Query keys must come from `lib/queryKeys.ts` key factories, never inline strings.
5. **Amount handling** — monetary strings must use `parseAmount()` from `lib/utils.ts`, never bare `Number()` or `parseFloat()`.
6. **Amount display** — use `AmountCell` or `formatCurrency()` for consistent rendering. Never format amounts ad-hoc inline.
7. **Forms** — must use React Hook Form + Zod schemas imported from `@finance/shared/schemas/*`. Never define validation logic locally that duplicates shared schemas.
8. **Type assertions** — avoid `as SomeType`. Fix the type gap at source, use a type guard, or parse with Zod.
9. **Shared package imports** — always use sub-path imports (`@finance/shared/schemas/auth`, `@finance/shared/types/transactions`, `@finance/shared/constants`). Never import from the bare `@finance/shared` package root.
10. **Auth tokens** — access tokens must be read from `storageKeys.ts` constants, never hardcoded strings.

## Review Checklist

For every file you examine, assess:

### Correctness

- Are there any logic bugs, off-by-one errors, or incorrect conditional branches?
- Are async operations (mutations, queries) handling loading and error states correctly?
- Are optimistic updates (if any) rolled back correctly on failure?
- Are React Query `invalidateQueries` calls targeting the correct keys after mutations?

### Architecture Adherence

- Does this file violate any cross-feature import rules?
- Is there any client-side re-aggregation that belongs in the API?
- Are query keys coming from `queryKeys.ts` factories?
- Are amounts always processed through `parseAmount()` / `formatCurrency()`?

### Type Safety

- Are there any `as` type assertions that could be replaced with a proper type guard or Zod parse?
- Are inferred types being widened unnecessarily (e.g., `any`, overly broad `string`)?
- Are props typed precisely, or are there catch-all `object` or `Record<string, unknown>` shortcuts?

### Component Design

- Are shadcn/ui primitives used from `components/ui/` or are there ad-hoc re-implementations?
- Are reusable app-aware pieces in `components/common/` rather than duplicated across features?
- Are components pure presentation or are they mixing data-fetching with rendering when they shouldn't be?
- Are there unnecessary re-renders caused by unstable object/array references in props or context values?

### React Query Usage

- Are `queryFn`s properly typed to return the expected shape?
- Are stale time and cache time set appropriately?
- Is error state propagated to the UI, or silently swallowed?
- Are mutations using `onSuccess`/`onError`/`onSettled` correctly?

### TanStack Router

- Are route search param schemas defined in `router.tsx` using Zod, not ad-hoc in components?
- Are route params validated before use?
- Is the `requireAuth` guard applied to all protected routes?

### Code Quality

- Is there dead code (unused imports, variables, functions, commented-out blocks)?
- Are there hardcoded strings that should be constants (toast messages, storage keys, query param names)?
- Are error boundaries placed appropriately?
- Is loading/skeleton state consistent across similar features?

## Deliverable

For each issue found, provide:

1. **File path and line number** (e.g., `src/features/transactions/hooks/useTransactions.ts:42`)
2. **Severity** — Critical / High / Medium / Low
3. **Category** — Bug / Architecture Violation / Type Safety / Performance / Code Quality
4. **Description** — what is wrong and why it matters
5. **Fix** — the corrected code or the specific change needed

Group findings by feature folder. At the end, provide a summary table with total counts per severity.
