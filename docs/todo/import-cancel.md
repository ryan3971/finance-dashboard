# Import Cancel

Allow the user to cancel an in-progress streaming import via a Cancel button in the progress UI.

> **Investigation required before implementation.** The backend cancellation
> behaviour — specifically what happens to rows already written when the user
> cancels mid-import — has not been fully designed. See the decision point below.

---

## Scope

**In scope:**
- Cancel button visible during the streaming import progress UI
- Stops the client from reading further SSE events
- Signals the server to stop processing new rows
- Marks the `imports` row with a terminal cancelled status

**Out of scope:**
- Cancelling the existing sync `POST /upload` endpoint
- Pause and resume
- Per-row rollback of AI categorization API calls already made

---

## Frontend

Add an `AbortController` to `useImportUpload.ts`:

```typescript
const abortRef = useRef<AbortController | null>(null);

async function handleSubmit(e: React.FormEvent) {
  const controller = new AbortController();
  abortRef.current = controller;

  const response = await fetch(..., { signal: controller.signal });
  // existing stream reading loop — AbortError is caught by the existing catch block
}

function cancel() {
  abortRef.current?.abort();
  abortRef.current = null;
  setLoading(false);
  setProgress(null);
}
```

Expose `cancel` from the hook return value. Show a Cancel button in `ImportPage.tsx` during any `showProgress` state.

The `AbortError` thrown when the signal fires lands in the existing `catch` block — no new error path needed.

---

## Backend

### Detect client disconnect

In the `POST /upload/stream` route handler, set a flag when the client closes the connection:

```typescript
let cancelled = false;
req.on('close', () => { cancelled = true; });
```

### Thread the flag into the row loop

Pass a `isCancelled` predicate into `processAllRows` and check it between rows:

```typescript
if (isCancelled()) break;
```

### Mark import as cancelled

When the loop exits early due to cancellation, update the `imports` row with a new `status: 'cancelled'` rather than `status: 'complete'`, and skip emitting the `complete` SSE event (the connection is already closed).

### New status constant

Add `CANCELLED: 'cancelled'` to `IMPORT_STATUS` in `src/lib/constants.ts` and update the DB schema enum if the `status` column is typed as an enum rather than a plain string.

---

## Decision point — partial rows

> **This is the key question that needs investigation before implementation.**

When a user cancels at row N of M, rows 1 through N are already committed to the `transactions` table. Two options:

| Option | Complexity | Trade-off |
|---|---|---|
| **Leave partial rows** | Low | `imports` row shows `status: 'cancelled'` with partial counts. A re-import deduplicates already-written rows via `compositeKey` automatically — the user gets a clean result on retry. |
| **Delete partial rows** | High | Requires the entire insert loop to run inside a single DB transaction, which means restructuring `processImport` significantly. AI API calls already made cannot be rolled back regardless. |

Leaving partial rows is likely the right call given the existing `compositeKey` deduplication, but this should be confirmed before writing any code.

---

## Files to change

1. `src/lib/constants.ts` — add `CANCELLED` to `IMPORT_STATUS`
2. `apps/api/src/features/imports/import.service.ts` — add `isCancelled` predicate param to `processAllRows`; early-exit loop and mark import cancelled
3. `apps/api/src/features/imports/imports.routes.ts` — add `req.on('close', ...)` flag; pass predicate to `processImport`
4. `apps/web/src/features/import/hooks/useImportUpload.ts` — add `AbortController` ref; expose `cancel()`
5. `apps/web/src/features/import/ImportPage.tsx` — render Cancel button during progress state
6. `apps/api/src/features/imports/imports.routes.test.ts` — test that cancelling mid-stream results in a `cancelled` import status and partial row count
