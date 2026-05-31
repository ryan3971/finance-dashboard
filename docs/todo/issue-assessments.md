# Issue Assessments

Methodical review of post-MVP issues. Each entry records what was investigated, what was found, and what action (if any) is needed.

---

## Category / Subcategory Blank in Review Panel and Rule Editor

**Source:** post-mvp-todo.md → Categories → General
**Status:** Fixed

### Root Cause

`loadRules(userId)` was fetching **both** the user's own rules and system rules (`userId = null`) simultaneously:

```ts
or(eq(categorizationRules.userId, userId), isNull(categorizationRules.userId))
```

At registration, system categories are copied to user-owned categories with new UUIDs, and system rules are copied with their `categoryId` values remapped to the user's UUIDs. This means for every keyword, two rules exist in the DB: a user rule (pointing at a user UUID) and a system rule (pointing at a system UUID). Both have the same priority, so whichever DB row the query returned first won — non-deterministically.

When the system rule fired, the transaction was stored with a system category UUID (`categories.userId = null`). `getCategoryTree(userId)` only returns user-owned categories (`eq(categories.userId, userId)`), so the UUID was never found and `CategorySelect` showed blank.

### Fix Applied

**`apps/api/src/pipelines/categorization/rules-engine.ts`** — When `userId` is provided, only load that user's own rules. System rules are already copied to every user at registration with correctly remapped category IDs; re-loading them live causes the conflict:

```ts
// Before
or(eq(categorizationRules.userId, userId), isNull(categorizationRules.userId))

// After
eq(categorizationRules.userId, userId)
```

### Existing Data Repair

Transactions already stored with system category UUIDs won't resolve in `getCategoryTree` even after the `loadRules` fix. A repair endpoint was added:

**`POST /api/v1/categories/repair`** — Scans the authenticated user's transactions for system category UUIDs and remaps them to the equivalent user-owned UUIDs (matched by name and hierarchy). Returns `{ updated: number }`. Safe to call multiple times.

Call this once via Bruno to clean up existing affected transactions.

---

## Amex Import — Transaction Marked with Wrong Sign

**Source:** post-mvp-todo.md → Importing → Amex Import
**Status:** No bug found — deferred for manual verification

### Assessment

The sign logic in `apps/api/src/features/imports/adapters/amex/amex.adapter.ts` (line 59) is correct:

```
const amount = -parseAmount(row[3]);
```

Amex CSVs export charges as positive and payments as negative. The negation aligns both with the app's convention (expenses negative, income positive):

| CSV value | Meaning | Stored |
|-----------|---------|--------|
| `12.00` | Charge (money out) | `-12.00` ✓ |
| `-245.00` | Payment to card | `+245.00` ✓ |

All 20 adapter unit tests pass. The parser handles `\r\n` line endings and quoted fields correctly. No additional sign manipulation occurs in the import pipeline after the adapter runs.

### Most Likely Cause of Original Incident

**Merchant refund/credit.** Amex CSVs represent refunds as negative values (e.g., `-50.00`). After negation they are stored as `+50` — positive/income. This is financially correct but may look like a bug. The "better way to mark refunds" item on the todo list is the relevant follow-up.

### Deferred Action

Delete the incorrect transaction once delete functionality is implemented, reimport, and trace the specific CSV value through the adapter to confirm behaviour.
