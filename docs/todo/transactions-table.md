# TransactionsTable — Deferred Issues

## Bugs

### `+$0.00` formatting for zero-amount transactions
**File:** `apps/web/src/features/transactions/AmountCell.tsx`

`formatAmount` prefixes any non-negative number with `+`. A zero-value transaction renders as `+$0.00`. Decide on the desired display (e.g. `$0.00` with no sign, or keep `+`) and update `formatAmount` accordingly.

### Stale `reviewingId` when changing pages
**File:** `apps/web/src/features/transactions/TransactionsPage.tsx`

`reviewingId` state lives in `TransactionsPage`. When the user navigates to a different page, the reviewed transaction is no longer in the list so the panel silently disappears — but the state remains set. `handlePageChange` should clear `reviewingId` before navigating:
```ts
function handlePageChange(newPage: number) {
  setReviewingId(null);
  void navigate({ search: (prev) => ({ ...prev, page: newPage }) });
}
```

---

## Type Safety

### No NaN guard on `amount` parsing
**File:** `apps/web/src/features/transactions/AmountCell.tsx`, `useTransactionColumns.tsx`

`parseFloat(amount)` silently produces `NaN` if the API ever returns a non-numeric string. Consider a branded `AmountString` type at the `useTransactions` boundary, or at minimum a runtime guard in `AmountCell`:
```ts
const num = parseFloat(amount);
if (Number.isNaN(num)) return <span className="text-danger">—</span>;
```
