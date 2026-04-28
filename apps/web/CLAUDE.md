# Web — CLAUDE.md

Guidance specific to `apps/web`.

## Structure (`src/`)

- `features/` — Domain modules. Each feature is self-contained: no imports across feature boundaries.
- `components/ui/` — Generic, reusable UI primitives (shadcn components and others). No app-specific or domain logic.
- `components/common/` — Reusable app-aware components shared across features (e.g. `EmptyState`, `FormField`, `Pagination`, `CategorySelect`, `DeleteConfirmDialog`, `YearSelector`).
- `components/transactions/` — Transaction UI components shared across feature boundaries (e.g. `TransactionTablePane`, used from both `TransactionsPage` and dashboard pages).
- `components/layout/` — Layout and navigation (e.g. `PageLayout`, `NavBar`).
- `components/error/` — Error boundaries.
- `hooks/` — Custom React hooks shared across multiple features (`useCategories`, `useAccounts`, `useCategoryMutations`, `useMediaQuery`). Feature-specific hooks live inside the feature under `hooks/`.
- `lib/` — Axios instance (`api.ts`), config, React Query keys (`queryKeys.ts`), localStorage keys (`storageKeys.ts`)
- `router.tsx` — Route tree, typed router context, `requireAuth` guard, search param schemas
- `main.tsx` — Entry point; `AuthProvider`, `RouterWrapper` (syncs auth context into router), `ErrorBoundary`

### Feature folder structure

Each feature can include any of the following — only add a folder when it's needed:

```
features/<name>/
  assets/       # static files scoped to this feature
  components/   # components scoped to this feature; may be grouped further by use or role within the feature
  hooks/        # data and logic hooks scoped to this feature
  stores/       # state stores scoped to this feature
  types/        # TypeScript types used within this feature
  utils/        # utility functions scoped to this feature
  <Name>Page.tsx
```

`hooks/` is always kept separate from `components/` — hooks are data/logic, not view layer.

**No barrel files** — do not create `index.ts` re-export files inside feature folders. Import directly from the source file. This keeps Vite's tree-shaking effective and avoids circular dependency risk.

## Constants

- **localStorage keys** — use `STORAGE_KEYS` from `@/lib/storageKeys` (`ACCESS_TOKEN`, `USER`). Never use the raw strings directly.
- **React Query keys** — use the key factories in `@/lib/queryKeys` (`transactionKeys`, `accountKeys`, `categoryKeys`, `tagKeys`, `dashboardKeys`, `anticipatedBudgetKeys`, `ruleKeys`, `userConfigKeys`, `rebalancingKeys`). Never use raw arrays like `['tags']`. Add a new key factory to `queryKeys.ts` for every new endpoint before writing the hook that calls it.
- **Cross-app constants** (field limits, transfer keywords, default currency) — import from `@finance/shared`.

## Auth

Auth state (access token) lives in React Context (`AuthProvider`), not localStorage. The refresh token cookie is sent automatically by the browser.

## React conventions

When mapping over a list that renders multiple sibling elements per item, use `<Fragment key={...}>` (named import from `react`) instead of `<>`. The shorthand `<>` does not accept a `key` prop.

## Forms

All forms use **React Hook Form** with a **Zod resolver**. The pattern:

1. Define the schema in `packages/shared/src/schemas/` and export it from the shared index — this lets the API and web share the same schema with no duplication.
2. `useForm<T>({ resolver: zodResolver(schema), defaultValues: { ... } })`
3. Spread `register('field')` directly onto `<Input>` and `<Select>` — both forward refs and accept all HTML attributes, so no wrapper needed.
4. Use `Controller` only for non-native inputs (custom pickers, third-party components).
5. Pass `formState.errors.field?.message` to `<FormField>`'s `error` prop for inline display.
6. Keep server/API errors in a separate `useState` — they are a different concern from field validation and should not go into RHF's error state.

Do not use `useState` per field for form inputs. Do not mix controlled `value`/`onChange` state with `register` on the same field.

Not everything with inputs is a form. Components that fire mutations directly on click (no submit), or filter bars driven by parent state, do not need RHF.

## Dashboard features

Dashboard pages live in `features/dashboards/`. Each tab is a separate sub-feature:

```
features/dashboards/
  income/
  expenses/
  snapshot/
  ytd/
  investments/   (placeholder — not yet built)
```

`features/anticipated-budget/` is a top-level feature (not under dashboards).

**Data fetching** — each dashboard page has a dedicated query hook (e.g. `useSnapshotData`, `useIncomeData`). Use the query key factories in `@/lib/queryKeys`. Dashboard queries are not paginated — they return complete shaped responses.

**Presentation derivations** — percentages, colour states (over/under budget), and formatted values are computed in the component from the values returned by the API. Never send a second request to derive what can be computed from the first response.

**No re-aggregation on the client** — the API returns pre-aggregated totals. Do not sum raw transaction arrays on the client side for dashboard views.

**Needs/wants splits** — display income-side splits using `user_config` percentage fields. Display expense-side splits using the `need_want` field on transactions. These are different sources — do not conflate them.

**Progress bars and over-budget indicators** — compute `actual / expected` client-side from the values in the API response. Apply a red/error state when the ratio exceeds 1.0. Never hardcode thresholds.

**Anticipated budget entry pattern** — collapsed cards, expandable to 12 month chips, default vs override chips visually distinct (see `anticipated_budget_entry_design.html` in the project root for the reference mockup). Yearly total computed client-side by summing resolved monthly amounts.

**Snapshot tab** — no month selector, always reflects current state. Live badge in header. Two-column top grid (Accounts | Monthly Income & Expenses), full-width Expected vs Actual card below (see `snapshot_dashboard.html` in the project root for the reference mockup).

## Dev proxy

Vite proxies `/api` to `localhost:3000` in dev.

---

## Design System

### Color Tokens (`tailwind.config.js` + `index.css`)

**Surfaces**
| Token | Hex | Use |
|---|---|---|
| `surface` / `bg-surface` | `#FFFFFF` | Cards, panels, table backgrounds |
| `surface-subtle` | `#F9FAFB` | Table header rows, hover backgrounds |
| `surface-muted` | `#F3F4F6` | Chips, skeleton fills, muted backgrounds |

**Borders**
| Token | Hex | Use |
|---|---|---|
| `border-subtle` | `#F3F4F6` | Dividers inside tables/lists |
| `border-base` | `#E5E7EB` | Card/panel outer borders |
| `border-strong` | `#D1D5DB` | Form input borders |

**Text**
| Token | Hex | Use |
|---|---|---|
| `content-primary` | `#111827` | Headings, primary body text, active values |
| `content-secondary` | `#6B7280` | Table cell text, labels, secondary info |
| `content-muted` | `#9CA3AF` | Placeholders, metadata, hover-reveal actions |
| `content-disabled` | `#D1D5DB` | Disabled inputs |

**Semantic States**
| Token | Use |
|---|---|
| `positive` / `positive-bg` | Income, success, active status — green `#16A34A` |
| `danger` / `danger-bg` | Expenses, errors, destructive actions — red `#DC2626` |
| `warning` / `warning-bg` / `warning-border` | Flagged for review, transfer candidates — amber |
| `info` / `info-bg` / `info-border` | Edit/review panels, "Need" classification — blue `#1D4ED8` |
| `accent` / `accent-bg` | "Want" classification, accent UI — purple `#7E22CE` |

Avoid raw Tailwind `gray-*`, `blue-*`, `green-*` in semantic contexts — use the named tokens above.

### Typography Scale

| Class combo                                      | Use                                   |
| ------------------------------------------------ | ------------------------------------- |
| `text-xl font-semibold`                          | Page `<h1>`                           |
| `text-lg font-semibold`                          | Section titles                        |
| `text-sm font-medium`                            | Panel headings, form labels           |
| `text-sm`                                        | Table rows, body text                 |
| `text-xs font-semibold uppercase tracking-wider` | Column headers, section group labels  |
| `text-xs`                                        | Chips, badges, metadata               |
| `font-mono`                                      | Amounts (`AmountCell`), rule keywords |

### Border Radius

| Class          | Value               | Use                                        |
| -------------- | ------------------- | ------------------------------------------ |
| `rounded`      | 0.25rem             | Chips, tags, `sm` buttons                  |
| `rounded-md`   | ~6px                | `md` buttons, inputs                       |
| `rounded-lg`   | 0.5rem (`--radius`) | Cards, panels, table wrappers              |
| `rounded-full` | pill                | Tag pills, count badges, status indicators |

### Spacing Patterns

- **Page layout:** `max-w-6xl mx-auto px-4 py-6` (via `PageLayout`)
- **Content card:** `bg-surface rounded-lg border border-border-base p-6`
- **Table card:** `bg-surface rounded-lg border border-border-base overflow-hidden` (no padding)
- **Inline / drawer panel interior:** `px-4 py-4 space-y-4`
- **Table header:** `th-cell` → `px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider`
- **Table data:** `td-cell` → `px-4 py-3 text-sm text-content-secondary`
- **Between form fields:** `space-y-4`

---

## Component Patterns

### Cards and Table Wrappers

Plain content card:

```tsx
<div className="bg-surface rounded-lg border border-border-base p-6">
```

Table-containing card (no inner padding) — always use the TanStack variant below.
The legacy pattern using `bg-white`, `rounded`, and `w-full` is incorrect and should
not be replicated.

TanStack Table variant (used in `TransactionsTable`):

```tsx
<div className="bg-surface rounded-lg border border-border-base overflow-hidden">
  <table className="min-w-full divide-y divide-border-subtle">
    <thead className="bg-surface-subtle">  {/* th uses th-cell or meta.thClassName */}
    <tbody className="divide-y divide-border-subtle">  {/* td uses td-cell or meta.tdClassName */}
```

Column-specific cell classes go in `column.meta.thClassName` / `column.meta.tdClassName`, not inline in the table renderer.

### Inline Expand/Edit Panel Pattern

Used in `AccountRow` and `TransactionsTable`. A hidden row is inserted directly below the data row:

```tsx
<Fragment key={row.id}>
  <tr>...</tr>
  {isExpanded && (
    <tr>
      <td colSpan={N} className="p-0">
        <SomePanelComponent />
      </td>
    </tr>
  )}
</Fragment>
```

Panel shell: `bg-info-bg border-t border-info-border px-4 py-4 space-y-4`.
Panel header: `flex items-center justify-between` — title `text-sm font-medium text-content-primary`, close button `✕`.

### Side Drawer Panel

```tsx
<div className="fixed inset-y-0 right-0 w-96 bg-surface border-l border-border-base shadow-xl overflow-y-auto z-40 flex flex-col">
```

Header bar: `flex items-center justify-between px-4 py-4 border-b border-border-subtle`.

### Badge / Pill System (`components/ui/Badge`)

`<Badge variant="..." rounded="sm|full">`

| Variant   | Colors                                                        | When to use            |
| --------- | ------------------------------------------------------------- | ---------------------- |
| `success` | `bg-positive-bg text-positive`                                | Active status          |
| `neutral` | `bg-surface-muted text-content-secondary`                     | Inactive status        |
| `warning` | `bg-warning-subtle text-warning border border-warning-border` | Flagged/pending review |
| `info`    | `bg-info-subtle text-info`                                    | "Need" classification  |
| `accent`  | `bg-accent-bg text-accent`                                    | "Want" classification  |

`rounded="full"` for count/summary pills; `rounded="sm"` (default) for classification labels.

### Tag Pills

Custom-colored via inline style: `style={{ backgroundColor: tag.color ?? '#6B7280', color: '#fff' }}`.
Shape: `rounded-full px-2 py-0.5 text-xs font-medium`. Selected: `opacity-100`. Unselected: `opacity-40 hover:opacity-70`.

### Hover-Reveal Actions

```tsx
<span className="group">
  <button className="opacity-0 group-hover:opacity-100 transition-opacity ...">
```

Used for inline edit/delete on chips (`SubcategoryChip`) and table rows (`RulesTab`).

### Button Variants (`components/ui/Button`)

| Variant     | Use                                                       |
| ----------- | --------------------------------------------------------- |
| `primary`   | Main CTA — dark bg, white text                            |
| `secondary` | Alternative/cancel — bordered, no fill                    |
| `ghost`     | Inline/tertiary actions — text only                       |
| `warning`   | Destructive-but-reversible (deactivate, confirm transfer) |

Sizes: `sm` (`px-3 py-1 text-xs rounded`), `md` (`px-4 py-1.5 text-sm rounded-md`).

### Need/Want Toggle Group

Segmented button group (not `<select>`):

```tsx
// active:   bg-content-primary text-white border-content-primary
// inactive: border-border-strong text-content-secondary hover:bg-surface-subtle
<button className={`px-3 py-1 text-xs rounded border transition-colors ${active ? '...' : '...'}`}>
```

### Section Group Heading

```tsx
<h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
```

### `components/transactions/`

Transaction UI components shared across feature boundaries — e.g. `TransactionTablePane`
is used from both `TransactionsPage` and dashboard pages.

Differs from `components/common/` (domain-agnostic) and `features/transactions/components/`
(panels, filters, and column definitions scoped entirely to the transactions feature).

### Component State Conventions

| State               | Convention                                                          |
| ------------------- | ------------------------------------------------------------------- |
| Inactive / archived | `opacity-50` on the row                                             |
| Transfer (neutral)  | `opacity-60` on the row                                             |
| Flagged for review  | `bg-warning-bg` on the row                                          |
| Editing (inline)    | Replace display span with `<Input>` + Save/Cancel inline            |
| Loading / pending   | Disable button with `mutation.isPending`; `<Skeleton>` for lists    |
| Empty               | `<EmptyState>` centered with `py-12`                                |
| Field error         | `FormField error` prop → `text-sm text-danger` below input          |
| Server error        | Separate `useState`, `text-xs text-danger` or `text-sm text-danger` |

### EmptyState (`components/common/EmptyState`)

```tsx
<EmptyState
  message="No items."
  hint="Optional sub-text."
  variant="default|error"
/>
// default: text-content-muted; error: text-danger; container: text-center py-12
```

### Skeleton Loading

`<Skeleton className="h-4 w-32" />` — match dimensions of real content. Use `rounded-full` on status indicator skeletons. Generate lists with `Array.from({ length: N }, (_, i) => \`skeleton-${i}\`)`.

### Form Control Utilities (`index.css @layer components`)

| Utility       | Use                                                                                |
| ------------- | ---------------------------------------------------------------------------------- |
| `input-base`  | Full-width text inputs                                                             |
| `select-base` | `<select>` and date inputs in filter bars                                          |
| `label-sm`    | Standard form label (`text-sm font-medium text-content-secondary mb-1`)            |
| `label-xs`    | Compact label inside panels                                                        |
| `th-cell`     | Transaction/account table headers (`font-medium text-content-secondary text-left`) |
| `td-cell`     | Transaction/account table data cells                                               |
| `th-class`    | Dashboard table headers (`font-semibold text-content-muted`, no forced text-left)  |
| `td-class`    | Dashboard table data cells (same styles as `td-cell`)                              |

Use `<FormField label="..." error={...} labelSize="xs|sm">` for all form fields.

## Responsive Design

### Breakpoints

Use `sm` (640px) as the primary mobile/desktop dividing line. Use `md` (768px)
for secondary column reveals (e.g. lower-priority table columns).

- Default (no prefix): mobile layout
- `sm:`: tablet and up — most layout changes happen here
- `md:`: desktop — used sparingly for table column visibility only

### Tables — DataTable component

All tables must be wrapped in `<DataTable>` from `@/components/ui/DataTable`.
It provides the card shell (`bg-surface rounded-lg border border-border-base
overflow-hidden`) and an inner `overflow-x-auto` scroll container. Never apply
these styles manually on a new table.

```tsx
// Standard usage
<DataTable>
  <table className="min-w-full ...">

// With toolbar (e.g. column toggle) and footer (e.g. pagination)
<DataTable toolbar={<ColumnVisibilityToggle />} footer={<Pagination />}>
  <table className="min-w-full ...">

// With extra classes on the card (e.g. opacity transition)
<DataTable className="transition-opacity duration-200 ...">

// With a max height (inner scroll container)
<DataTable maxHeight="400px">
```

### className Organization

Order classes consistently: **layout → visual → conditional**. The ordering is
enforced by convention — no inline comments needed.

```tsx
// Short / unconditional — plain string, layout then visual
<td className="px-4 py-3 text-right text-sm font-mono text-content-secondary">

// Long or conditional — cn(), same order, conditional always last
<td className={cn(
  'px-4 py-3 text-right',
  'text-sm font-mono font-medium',
  isOverBudget && 'text-danger',
)}>

// Accepting external className prop — always cn()
<div className={cn('px-4 py-3 bg-surface rounded-lg', className)}>
```

**Layout utilities:** `flex grid gap p m w h items-* justify-* col-span-*`
**Visual utilities:** `bg text border rounded shadow opacity transition`

**Use `cn()` when:**

- Any conditional class is present
- The component accepts an external `className` prop
- Two class sources need to be merged

**Use a plain string when:**

- Classes are unconditional and fit on one readable line

Never wrap a single unconditional string in `cn()` — it adds noise with no benefit.
Never mix `cn()` and string interpolation on the same element.

## Naming & Structure Conventions

- Custom utilities live in `@layer components` in `src/index.css`.
- Semantic color tokens (`content-primary`, `surface-muted`) are always preferred over raw Tailwind palette classes.
- Column-specific classes for TanStack Table go in `meta.thClassName` / `meta.tdClassName` on the column def.

---

## Data & Domain Conventions

### Amount types

Monetary amount fields differ by endpoint:

- **Dashboard endpoints** (`/dashboard/income`, `/anticipated-budget`, etc.) — amounts are `number` in the response. Use them directly; no conversion needed.
- **Transaction endpoints** — `transaction.amount` is `string` (Drizzle numeric passthrough). Use `parseAmount(s)` from `@/lib/utils` whenever a number is needed (display, sorting, form initialisation). Never use bare `Number()` or `parseFloat()` on a monetary string.

`parseAmount` handles `null`/`undefined` and guards against `NaN` — always prefer it over ad-hoc coercions.

### Amount Display

Always use `AmountCell` (or equivalent logic):

- Positive (income): `+CAD X.XX`, color `text-positive`
- Negative (expense): `-CAD X.XX`, color `text-danger`
- Transfer (neutral): `text-content-muted`
- Format: `Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })`
- Always `font-mono text-sm font-medium`

### Category Hierarchy

- `Category` has `isIncome: boolean` and `subcategories[]`.
- Display path uses `›` separator: `Category › Subcategory`
- `NeedWant`: `'Need' | 'Want' | 'NA'` — `Need` → `info` badge; `Want` → `accent` badge; `NA` → not shown

### Transaction States

- `flaggedForReview` — needs categorization; row gets `bg-warning-bg`
- `isTransfer` — internal transfer, excluded from totals; row gets `opacity-60`
- Transfer candidate — `flaggedForReview && description matches TRANSFER_KEYWORDS` — shows confirm/dismiss UI in review panel

### Import Result Summary

`<dl>` / `<dt>` / `<dd>` layout. Color highlights: green = imported, yellow = flagged, blue = transfer candidates, red = errors.

### Account Types (display order)

`chequing → savings → credit → tfsa → fhsa → rrsp → non-registered` (from `ACCOUNT_TYPE_ORDER` in `@finance/shared`)

### Pagination

Default page size: 50. Export limit: 10,000. Filter state stored in URL search params via TanStack Router.
