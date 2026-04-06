# AccountsPage — Deferred Issues

## Bugs

### Reactivate fires without confirmation
**File:** `apps/web/src/features/accounts/AccountsPage.tsx` / `AccountRow.tsx`

The "Reactivate" button fires `reactivate.mutate` immediately on click. Unlike deactivation, there is no confirmation step. While reactivation is less destructive, the inconsistency is a misclick risk. Fix would mirror the existing `DeactivateAccountDialog` pattern — add a `confirmReactivateAccount: Account | null` state and a second dialog (or generalize both into a shared `AccountStatusDialog`).

### `reactivate.isPending` not scoped per account
**File:** `apps/web/src/features/accounts/AccountRow.tsx`

`reactivateIsPending` is a single boolean from the shared mutation instance. If multiple inactive accounts are visible, all their "Reactivate" buttons disable when any one reactivation is in flight. The proper fix is to read `reactivate.variables` (the id currently being mutated) and compare it to `account.id` to disable only the relevant row. Alternatively, track a `pendingReactivateId: string | null` state in the page.

---

## Accessibility

### Action buttons lack accessible labels
**File:** `apps/web/src/features/accounts/AccountRow.tsx`

"Edit", "Deactivate", and "Reactivate" buttons have no association with the account name. Screen readers announce them without context. Add `aria-label`:
```tsx
<Button aria-label={`Edit ${account.name}`} ...>Edit</Button>
<Button aria-label={`Deactivate ${account.name}`} ...>Deactivate</Button>
<Button aria-label={`Reactivate ${account.name}`} ...>Reactivate</Button>
```

### Table has no accessible label
**File:** `apps/web/src/features/accounts/AccountsPage.tsx`

Add `aria-label="Accounts"` to the `<table>` element.

### Expanded edit panel does not move focus
**File:** `apps/web/src/features/accounts/AccountRow.tsx`

When `AccountEditPanel` renders inline after clicking "Edit", keyboard focus stays on the button. The panel's appearance is not announced. Move focus to the first focusable element inside the panel on open, or add `aria-expanded` to the Edit button.

### Inactive row dimming is purely visual
**File:** `apps/web/src/features/accounts/AccountRow.tsx`

`opacity-50` on inactive rows communicates status visually only. The Badge text ("Inactive") already provides a programmatic signal, so this is low priority — but consider whether `aria-disabled="true"` on the row adds meaningful context for screen reader users.
