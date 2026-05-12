# TransactionsTable — Deferred Issues

## Bugs

### `+$0.00` formatting for zero-amount transactions
**File:** `apps/web/src/features/transactions/AmountCell.tsx`

`formatAmount` prefixes any non-negative number with `+`. A zero-value transaction renders as `+$0.00`. Decide on the desired display (e.g. `$0.00` with no sign, or keep `+`) and update `formatAmount` accordingly.
