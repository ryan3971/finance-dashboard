# Web Design System

Visual conventions for `apps/web`. Read before writing or restyling markup.

Token *values* live in `tailwind.config.js` and `src/index.css` — this file maps each token to the
situation it belongs in, which is the part the source doesn't state. When a value here disagrees
with the config, the config wins.

## Color Tokens

**Surfaces** — `surface` (cards, panels, table backgrounds), `surface-subtle` (table header rows,
hover backgrounds), `surface-muted` (chips, skeleton fills).

**Borders** — `border-subtle` (dividers inside tables and lists), `border-base` (card and panel
outer borders), `border-strong` (form input borders).

**Text** — `content-primary` (headings, body text, active values), `content-secondary` (table cell
text, labels), `content-muted` (placeholders, metadata, hover-reveal actions), `content-disabled`
(disabled inputs).

**Semantic states** — each has a `DEFAULT` plus `-bg`, and some have `-border`, `-subtle`, `-action`:

| Token     | Meaning                                                    |
| --------- | ---------------------------------------------------------- |
| `positive`| Income, success, active status                             |
| `danger`  | Expenses, errors, destructive actions                      |
| `warning` | Flagged for review, transfer candidates                    |
| `info`    | Edit/review panels, "Need" classification                  |
| `accent`  | "Want" classification, accent UI                           |

In any semantic context, reach for these named tokens rather than the raw Tailwind palette
(`gray-*`, `blue-*`, `green-*`).

## Typography Scale

| Class combo                                      | Use                                   |
| ------------------------------------------------ | ------------------------------------- |
| `text-xl font-semibold`                          | Page `<h1>`                           |
| `text-lg font-semibold`                          | Section titles                        |
| `text-sm font-medium`                            | Panel headings, form labels           |
| `text-sm`                                        | Table rows, body text                 |
| `text-xs font-semibold uppercase tracking-wider` | Column headers, section group labels  |
| `text-xs`                                        | Chips, badges, metadata               |
| `font-mono`                                      | Amounts (`AmountCell`), rule keywords |

## Border Radius

| Class          | Use                                        |
| -------------- | ------------------------------------------ |
| `rounded`      | Chips, tags, `sm` buttons                  |
| `rounded-md`   | `md` buttons, inputs                       |
| `rounded-lg`   | Cards, panels, table wrappers              |
| `rounded-full` | Tag pills, count badges, status indicators |

## Spacing

- **Page layout** — `max-w-6xl mx-auto px-4 py-6`, applied by `PageLayout`
- **Between form fields** — `space-y-4`
- **Inline / drawer panel interior** — `px-4 py-4 space-y-4`

## Cards and Tables

Plain content card:

```tsx
<div className="bg-surface rounded-lg border border-border-base p-6">
```

Tables go inside `<DataTable>` from `@/components/ui/DataTable`, which supplies the card shell and
an inner `overflow-x-auto` container:

```tsx
<DataTable>                                          {/* standard */}
<DataTable toolbar={<ColumnVisibilityToggle />} footer={<Pagination />}>
<DataTable className="transition-opacity duration-200">   {/* extra card classes */}
<DataTable maxHeight="400px">                        {/* inner scroll container */}

  <table className="min-w-full divide-y divide-border-subtle">
    <thead className="bg-surface-subtle">   {/* th uses th-cell or meta.thClassName */}
    <tbody className="divide-y divide-border-subtle">  {/* td uses td-cell or meta.tdClassName */}
```

Four cards in `dashboards/snapshot` and `dashboards/investments` still hand-roll the shell from
before `DataTable` existed. They are the exception, not the pattern to copy; new tables use
`DataTable`.

Column-specific cell classes belong in `column.meta.thClassName` / `column.meta.tdClassName` on the
column def, rather than inline in the table renderer.

## Panels

**Inline expand/edit** (used in `AccountRow`, `TransactionsTable`) — a hidden row directly below the
data row:

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

Panel shell `bg-info-bg border-t border-info-border px-4 py-4 space-y-4`; header
`flex items-center justify-between` with a `text-sm font-medium text-content-primary` title and a
`✕` close button.

**Side drawer**:

```tsx
<div className="fixed inset-y-0 right-0 w-96 bg-surface border-l border-border-base shadow-xl overflow-y-auto z-40 flex flex-col">
```

Header bar: `flex items-center justify-between px-4 py-4 border-b border-border-subtle`.

## Badges, Pills, and Buttons

`<Badge variant="..." rounded="sm|full">` (`components/ui/Badge`) — variant colors are defined in the
component; the mapping to use:

| Variant   | When to use            |
| --------- | ---------------------- |
| `success` | Active status          |
| `neutral` | Inactive status        |
| `warning` | Flagged/pending review |
| `info`    | "Need" classification  |
| `accent`  | "Want" classification  |

`rounded="full"` for count and summary pills; `rounded="sm"` (default) for classification labels.

**Tag pills** carry a per-tag color via inline style —
`style={{ backgroundColor: tag.color ?? '#6B7280', color: '#fff' }}`, shape
`rounded-full px-2 py-0.5 text-xs font-medium`, selected `opacity-100`, unselected
`opacity-40 hover:opacity-70`.

`<Button variant="..." size="sm|md">` (`components/ui/Button`):

| Variant     | When to use                                               |
| ----------- | --------------------------------------------------------- |
| `primary`   | Main CTA                                                  |
| `secondary` | Alternative / cancel                                      |
| `ghost`     | Inline or tertiary actions                                |
| `warning`   | Destructive-but-reversible (deactivate, confirm transfer) |

**Need/Want toggle** is a segmented button group rather than a `<select>`:

```tsx
// active:   bg-content-primary text-white border-content-primary
// inactive: border-border-strong text-content-secondary hover:bg-surface-subtle
<button className={`px-3 py-1 text-xs rounded border transition-colors ${active ? '...' : '...'}`}>
```

**Hover-reveal actions** (inline edit/delete on `SubcategoryChip`, `RulesTab` rows):

```tsx
<span className="group">
  <button className="opacity-0 group-hover:opacity-100 transition-opacity ...">
```

**Section group heading**:

```tsx
<h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
```

## Component State Conventions

| State                                                  | Convention                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| Inactive / archived, resolved rebalancing group         | `opacity-50` on the row                                          |
| Transfer, investment contribution                       | `opacity-60` on the row                                          |
| Flagged for review                                      | `bg-warning-bg` on the row                                       |
| Editing inline                                          | Replace the display span with `<Input>` + Save/Cancel            |
| Loading / pending                                       | `mutation.isPending` disables the button; `<Skeleton>` for lists |
| Empty                                                   | `<EmptyState>`, centered, `py-12`                                |
| Field error                                             | `FormField` `error` prop → `text-sm text-danger` below the input |
| Server error                                            | Separate `useState`, `text-xs`/`text-sm text-danger`             |

`<EmptyState message="..." hint="..." variant="default|error" />` — `default` renders
`text-content-muted`, `error` renders `text-danger`.

`<Skeleton className="h-4 w-32" />` — match the dimensions of the real content, `rounded-full` for
status-indicator skeletons, and generate lists with
``Array.from({ length: N }, (_, i) => `skeleton-${i}`)``.

## Form Control Utilities

Defined in `@layer components` in `src/index.css`:

| Utility       | Use                                            |
| ------------- | ----------------------------------------------- |
| `input-base`  | Full-width text inputs                         |
| `select-base` | `<select>` and date inputs in filter bars      |
| `label-sm`    | Standard form label                            |
| `label-xs`    | Compact label inside panels                    |
| `th-cell`     | Transaction/account table headers              |
| `td-cell`     | Transaction/account table data cells           |
| `th-class`    | Dashboard table headers (no forced text-align) |
| `td-class`    | Dashboard table data cells                     |

Wrap every form field in `<FormField label="..." error={...} labelSize="xs|sm">`. New custom
utilities go in the same `@layer components` block.

## Responsive Design

`sm` (640px) is the primary mobile/desktop dividing line; `md` (768px) is reserved for secondary
column reveals such as lower-priority table columns.

- no prefix — mobile layout
- `sm:` — tablet and up; most layout changes land here
- `md:` — desktop; table column visibility only

## className Organization

Order classes **layout → visual → conditional**, with the conditional always last. Layout is
`flex grid gap p m w h items-* justify-* col-span-*`; visual is
`bg text border rounded shadow opacity transition`.

```tsx
// Unconditional and fits one line — plain string
<td className="px-4 py-3 text-right text-sm font-mono text-content-secondary">

// Long or conditional — cn()
<td className={cn(
  'px-4 py-3 text-right',
  'text-sm font-mono font-medium',
  isOverBudget && 'text-danger',
)}>

// Accepting an external className prop — always cn()
<div className={cn('px-4 py-3 bg-surface rounded-lg', className)}>
```

Import `cn` from `@/lib/utils`. Reach for it when a conditional class is present, when the component
accepts an external `className`, or when two class sources merge; use a plain string for a single
unconditional line, and keep interpolation out of any element that already uses `cn()`.
