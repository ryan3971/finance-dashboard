# Web — CLAUDE.md

`apps/web` specifics. Monorepo-wide conventions (barrel files, `@finance/shared` imports, type
assertions, dashboard layer rules) are in the root [`CLAUDE.md`](../../CLAUDE.md).

Writing or restyling markup — colors, typography, spacing, cards, tables, panels, badges, buttons,
row states, breakpoints, `className` order → read [`docs/design-system.md`](docs/design-system.md).

## Directory structure (`src/`)

- `features/` — domain modules, self-contained; imports never cross a feature boundary.
- `components/ui/` — generic UI primitives (shadcn and others), free of domain logic.
- `components/common/` — app-aware components shared across features (`EmptyState`, `FormField`,
  `Pagination`, `CategorySelect`, `DeleteConfirmDialog`, `YearSelector`).
- `components/transactions/` — transaction UI crossing feature boundaries, e.g.
  `TransactionTablePane`, used from both `TransactionsPage` and dashboard pages. Distinct from
  `components/common/` (domain-agnostic) and `features/transactions/components/` (panels, filters,
  and column defs scoped to that feature).
- `components/layout/` — `PageLayout`, `NavBar`.
- `components/error/` — error boundaries.
- `hooks/` — hooks used by more than one feature. Single-feature hooks live in that feature's
  `hooks/`.
- `lib/` — `api.ts` (axios instance), `queryKeys.ts`, `storageKeys.ts`, `utils.ts` (`cn`, `fmt`,
  `parseAmount`, date helpers), `toastMessages.ts` (`TOAST`), `errors.ts` (`getApiErrorMessage`),
  `helpContent.ts`, config.
- `router.tsx` — route tree, typed router context, `requireAuth` guard, search param schemas.
- `main.tsx` — entry point and provider tree; Sentry via `instrument.ts`, imported first.

Vite proxies `/api` to `localhost:3000` in dev.

### Feature folder structure

Add a folder when the feature needs it:

```
features/<name>/
  assets/       # static files scoped to this feature
  components/   # scoped components; may group further by role
  hooks/        # data and logic hooks
  stores/       # state stores
  types/        # types used within this feature
  utils/        # utility functions
  <Name>Page.tsx
```

`hooks/` stays separate from `components/` — hooks are data and logic, not view layer.

## Constants

- **localStorage keys** — `STORAGE_KEYS` from `@/lib/storageKeys`.
- **Cross-app constants** (field limits, transfer keywords, default currency, pagination limits,
  account type order) — `@finance/shared/constants`.
- **Toast strings** — the `TOAST` constant in `@/lib/toastMessages`.

Each of these is the single source for its strings; reaching for a raw literal instead is the thing
they exist to prevent.

## TanStack Query

Every query key comes from a factory in `@/lib/queryKeys`. A new endpoint gets its factory added
there before the hook that calls it is written.

### Stale-data loading

Dashboard query hooks set `placeholderData: keepPreviousData` and a 5-minute `staleTime`, so a key
change (year navigation) keeps the previous result on screen instead of blanking. Every new
dashboard query hook carries `placeholderData: keepPreviousData`. Pages wire the three states up as:

- `isPending` — first fetch only, with no cached or placeholder data. Pass through
  `useDelayedPending(isPending)` (`@/hooks/useDelayedPending`), which holds the skeleton back 200 ms to avoid a flash on fast
  loads, then render the skeleton.
- `isFetching` — any background refetch, key changes included. Dim the data wrapper:
  `className={cn('transition-opacity duration-200', isFetching && 'opacity-50')}`.
- `data` — render whenever truthy; on a key-change refetch this is the previous period's
  placeholder.

## Auth

Read auth state through `useAuth()` (`@/features/auth/useAuth`). `AuthProvider` holds the access
token and user in React Context and persists both to localStorage under `STORAGE_KEYS`; `login` and
`logout` keep the two in sync, so components go through the hook rather than touching localStorage.
The refresh token is an httpOnly cookie, sent because the axios instance in `@/lib/api` sets
`withCredentials: true`.

## Forms

React Hook Form with a Zod resolver:

1. Define the schema in `packages/shared/src/schemas/` so the API and web share it; import via
   `@finance/shared/schemas/<name>`.
2. `useForm<T>({ resolver: zodResolver(schema), defaultValues: { ... } })`
3. Spread `register('field')` straight onto `<Input>` and `<Select>` — both forward refs and accept
   all HTML attributes, so the field needs no wrapper and no per-field `useState`.
4. `Controller` covers non-native inputs (custom pickers, third-party components).
5. Pass `formState.errors.field?.message` to `<FormField>`'s `error` prop.
6. Keep server and API errors in their own `useState`, separate from RHF's field-validation state.

Not everything with inputs is a form: components that fire a mutation on click with no submit, and
filter bars driven by parent state, work without RHF.

## Toasts and errors

Call `toast()` directly from `sonner` with a string from `TOAST`:

```ts
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';

toast.success(TOAST.ACCOUNT_CREATED);
toast.error(TOAST.ACCOUNT_CREATE_FAILED);
```

`<Toaster>` is mounted once in `main.tsx`. Error boundaries live in `components/error/`, and API
error messages come out of `getApiErrorMessage` in `@/lib/errors`.

## React conventions

Mapping over a list that renders multiple sibling elements per item takes
`<Fragment key={...}>` (named import from `react`) — the `<>` shorthand accepts no `key` prop.

## Dashboard features

Dashboard tabs are sub-features of `features/dashboards/`: `income/`, `expenses/`, `snapshot/`,
`ytd/`, `investments/`. `features/anticipated-budget/` is top-level, not under dashboards.

The root `CLAUDE.md` sets the layer rules; on the client side they mean the page receives
pre-aggregated totals and derives presentation from that one response — percentages, over/under
budget colour states, formatted values — rather than summing transaction arrays or issuing a second
request.

**Data fetching** — dedicated query hooks in each sub-feature's `hooks/` (`useSnapshotDashboard`,
`useIncomeDashboard`), keyed through `dashboardKeys` (investments: `investmentKeys`). These queries
are unpaginated and return complete shaped responses.

**Needs/wants splits** — income-side splits come from `user_config` percentage fields; expense-side
splits come from the `need_want` field on transactions. Two different sources, kept distinct.

**Progress bars and over-budget indicators** — compute `actual / expected` client-side from the
response and switch to the error state above a ratio of 1.0, so the threshold stays derived rather
than hardcoded.

**Anticipated budget** — collapsed cards expand to 12 month chips, with default and override chips
visually distinct; the yearly total is summed client-side from resolved monthly amounts.

**Snapshot** — opens on the current month and steps one month at a time through URL search params,
with future months out of range.

## Amounts

Monetary fields differ by endpoint:

- **Dashboard endpoints** (`/dashboard/income`, `/anticipated-budget`) — `number`, usable directly.
- **Transaction endpoints** — `transaction.amount` is a `string` (Drizzle numeric passthrough).
  Convert with `parseAmount` from `@/lib/utils` for display, sorting, and form initialisation; it
  handles `null`/`undefined` and guards `NaN`, which bare `Number()` and `parseFloat()` do not.

Render a transaction amount through `AmountCell`
(`features/transactions/components/table/AmountCell.tsx`), which owns sign, colour, and currency
formatting.

## Domain conventions

**Categories** — `Category` carries `isIncome: boolean` and `subcategories[]`. Display path uses
`Category › Subcategory`. Need/Want is `'Need'`, `'Want'`, or `null` (unclassified); `Need` renders an `info` badge, `Want` an
`accent` badge, `null` nothing. `NeedWant` still lists `'NA'` as a wire-compat shim — no UI offers
it, and it's never read as its own class (ADR 0019, #43).

**Transaction states** — `flaggedForReview` needs categorization; `isTransfer` marks an internal
transfer excluded from totals; `isInvestmentContribution` is excluded from expense totals. A
transfer candidate is `flaggedForReview` plus a description matching `TRANSFER_KEYWORDS`, and shows
confirm/dismiss UI in the review panel. Row styling for each state is in the design system doc.

**Account type display order** — sort by `ACCOUNT_TYPE_ORDER` from `@finance/shared/constants`.

**Import result summary** — `<dl>`/`<dt>`/`<dd>`, with green for imported, yellow for flagged, blue
for transfer candidates, red for errors.

**Pagination** — limits from `PAGINATION` in `@finance/shared/constants`; filter state in URL
search params via TanStack Router.
