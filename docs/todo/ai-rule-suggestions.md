# AI Rule Suggestions

Automatically surfaces categorization rules from high-confidence AI results during import, held as persistent suggestions for user review, editing, and acceptance on the rules page.

## Depends on

**Rules Page Overhaul must be implemented first.** This feature uses `RuleEditModal` for editing suggestions before acceptance and places the suggestions panel inside the overhauled `RulesTab`. Do not implement Phase B without Phase A in place.

---

## Problem

When the AI categorizes a transaction with high confidence, that same categorization will likely apply to all future transactions from the same merchant. Currently that knowledge is discarded — the result is applied to the individual transaction, but no rule is created. The user must create rules manually after the fact.

---

## Scope

**In scope:**
- Generating and persisting rule suggestions from high-confidence AI categorizations during import
- Deduplication: one pending suggestion per `(userId, suggestedKeyword)` pair
- `suggestionCount` added to `ImportResult`
- Collapsible "Suggested rules" panel on the rules page (top of `RulesTab`)
- Accept (with optional inline edit before accepting) and dismiss actions per suggestion
- Extending Apply Rules to also cover AI-categorized transactions

**Out of scope:**
- Auto-accepting suggestions without user review
- Retroactive re-categorization on accept (user is directed to Apply Rules instead)
- Suggestions from rule-matched or manually-categorized transactions
- Bulk accept-all action (defer to a follow-on)
- Suggestion expiry / automatic cleanup

---

## Threshold

No new environment variable. Use the existing `AI_CONFIDENCE_THRESHOLD` (default `0.70`, configured via `ENABLE_AI_CATEGORIZATION` / `AI_CONFIDENCE_THRESHOLD` env vars) for both transaction categorization and rule suggestion generation. Rationale: suggestions require user confirmation before creating a rule, so the user review step is the safety net — a separate higher threshold adds config complexity without a clear benefit, especially given deduplication limits suggestion volume.

---

## Schema changes

**New table: `rule_suggestions`**

```sql
CREATE TABLE rule_suggestions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggested_keyword text NOT NULL,
  category_id       uuid REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id    uuid REFERENCES categories(id) ON DELETE SET NULL,
  need_want         text CHECK (need_want IN ('Need', 'Want', 'NA')),
  confidence        numeric(4, 3) NOT NULL,
  transaction_id    uuid REFERENCES transactions(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rule_suggestions_user_keyword_unique
  ON rule_suggestions (user_id, lower(suggested_keyword))
  WHERE status = 'pending';
```

The partial unique index on `(userId, lower(suggestedKeyword)) WHERE status = 'pending'` enforces deduplication: only one pending suggestion per keyword per user. Accepted and dismissed suggestions are not deduplicated — they serve as a history record.

**Drizzle schema** (`apps/api/src/db/schema.ts`):

```typescript
export const ruleSuggestions = pgTable('rule_suggestions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  suggestedKeyword: text('suggested_keyword').notNull(),
  categoryId:       uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  subcategoryId:    uuid('subcategory_id').references(() => categories.id, { onDelete: 'set null' }),
  needWant:         text('need_want'),  // stores AI's raw value; 'NA' is valid here but coerced to null on accept
  confidence:       numeric('confidence', { precision: 4, scale: 3 }).notNull(),
  transactionId:    uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  status:           text('status').notNull().default('pending'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## Shared types

**File:** `packages/shared/src/types/transactions.ts`

Add `suggestionCount` to `ImportResult`:

```typescript
export interface ImportResult {
  importId:              string;
  rowCount:              number;
  importedCount:         number;
  duplicateCount:        number;
  flaggedCount:          number;
  errorCount:            number;
  errors:                string[];
  transferCandidateCount:number;
  suggestionCount:       number;   // ← new
}
```

**New file:** `packages/shared/src/types/rule-suggestions.ts`

```typescript
export interface RuleSuggestion {
  id:               string;
  suggestedKeyword: string;
  categoryId:       string | null;
  categoryName:     string | null;
  subcategoryId:    string | null;
  subcategoryName:  string | null;
  needWant:         'Need' | 'Want' | 'NA' | null;
  confidence:       number;
  transactionId:    string | null;
  status:           'pending' | 'accepted' | 'dismissed';
  createdAt:        string;
}

export interface AcceptSuggestionInput {
  keyword?:      string;           // override suggestedKeyword before accepting
  categoryId?:   string | null;
  subcategoryId?:string | null;
  needWant?:     'Need' | 'Want' | null;
  priority?:     number;
  matchType?:    'substring' | 'wildcard';
}
```

---

## Config changes

None. `config.aiConfidenceThreshold` is reused as the suggestion threshold. No new env var.

---

## Backend changes

### Suggestion generation in `import.service.ts`

After a successful `processTransactionRow` call where `categorization.categorySource === 'ai'` and the transaction was actually inserted (not a duplicate), attempt to create a suggestion.

Add a helper function `maybeSuggestRule` called from `processTransactionRow`:

```typescript
async function maybeSuggestRule(
  userId: string,
  sourceName: string | null,
  categorization: CategorizationResult,
  transactionId: string
): Promise<boolean> {
  // Only generate a suggestion if sourceName is available — it becomes the keyword.
  // Without a clean merchant name, we have nothing useful to put in the rule.
  if (!sourceName) return false;
  if (categorization.categorySource !== CATEGORY_SOURCE.AI) return false;
  if (!categorization.categoryId) return false;

  // Deduplicate: skip if a pending suggestion already exists for this user + keyword.
  // Use INSERT ... ON CONFLICT DO NOTHING against the partial unique index.
  await db
    .insert(ruleSuggestions)
    .values({
      userId,
      suggestedKeyword: sourceName,
      categoryId:       categorization.categoryId,
      subcategoryId:    categorization.subcategoryId ?? null,
      needWant:         categorization.needWant,
      confidence:       String(categorization.categoryConfidence),
      transactionId,
      status:           'pending',
    })
    .onConflictDoNothing(); // partial unique index handles deduplication

  return true;
}
```

Call this immediately after a transaction is inserted in `processTransactionRow`, before returning. Collect a `newSuggestions` count in `processAllRows` (incremented when `maybeSuggestRule` returns true from an insert — use `returning({ id: ruleSuggestions.id })` to detect whether the insert was a no-op).

Add `suggestionCount: number` to the `result` object in `processImport` and populate it from `processAllRows`.

**Note on `needWant` for income:** The pipeline already sets `aiResult.needWant = null` for income transactions (`amount > 0`) before storing the categorization. Suggestions are generated after this correction, so `needWant` on the suggestion will already be `null` for income — no special handling needed here.

### `ImportResult` initialisation

```typescript
const result: ImportResult = {
  importId:              importRecord.id,
  rowCount:              rows.length,
  importedCount:         0,
  duplicateCount:        0,
  flaggedCount:          0,
  errorCount:            0,
  errors:                [],
  transferCandidateCount:0,
  suggestionCount:       0,   // ← new
};
```

### New feature: `rule-suggestions`

**Directory:** `apps/api/src/features/rule-suggestions/`

```
rule-suggestions.routes.ts
rule-suggestions.service.ts
rule-suggestions.errors.ts
rule-suggestions.routes.test.ts
```

#### Endpoints

**`GET /api/v1/rule-suggestions`**

Returns all `pending` suggestions for the authenticated user. Joins with `categories` to populate `categoryName` / `subcategoryName`. Order: `confidence DESC, createdAt DESC`.

Response: `RuleSuggestion[]`

No pagination — suggestion counts are bounded by deduplication; a user will never have thousands.

---

**`POST /api/v1/rule-suggestions/:id/accept`**

Accepts a suggestion, creating a categorization rule from it. The request body carries optional overrides the user may have edited before accepting.

Request body (all fields optional — omitting uses the suggestion's stored values):

```typescript
{
  keyword?:      string;
  categoryId?:   string | null;
  subcategoryId?:string | null;
  needWant?:     'Need' | 'Want' | null;
  priority?:     number;        // defaults to AUTO_RULE_PRIORITY (5)
  matchType?:    'substring' | 'wildcard';  // defaults to 'substring'
}
```

Service logic (in a DB transaction):
1. Fetch suggestion — 404 if not found, 403 if owned by another user
2. Assert `status === 'pending'` — 409 if already accepted or dismissed
3. Resolve final field values: body overrides take precedence over suggestion values. **Coerce `needWant = 'NA'` to `null`** — the `rule_suggestions` table stores the AI's raw value (which may be `'NA'` for transfers/repayments), but `categorization_rules` only accepts `'Need' | 'Want' | null`. Apply this coercion to whichever source wins (suggestion value or body override).
4. Call `createRule(userId, resolvedInput)` — reuses the service function added in Phase A
5. Update `rule_suggestions.status = 'accepted'`
6. Return the created `Rule` object

Response: `201` with the created `Rule`.

---

**`POST /api/v1/rule-suggestions/:id/dismiss`**

No request body.

Service logic:
1. Fetch suggestion — 404 / 403 as above
2. Assert `status === 'pending'`
3. Update `status = 'dismissed'`

Response: `204 No Content`

---

#### `rule-suggestions.errors.ts`

```typescript
export enum RuleSuggestionErrorCode {
  NOT_FOUND        = 'RULE_SUGGESTION_NOT_FOUND',
  ALREADY_ACTIONED = 'RULE_SUGGESTION_ALREADY_ACTIONED',
}
```

HTTP mappings: `NOT_FOUND` → 404, `ALREADY_ACTIONED` → 409.

---

### Apply Rules extension (`transactions.service.ts`)

**Current candidate query** in `fetchUncategorizedTransactions`:

```typescript
// current (simplified)
where(
  and(
    eq(transactions.userId, userId),
    not(eq(transactions.isTransfer, true)),
    notInArray(transactions.categorySource, ['manual', 'rule']),
    or(isNull(transactions.categoryId), eq(transactions.flaggedForReview, true))
  )
)
```

The last condition (`categoryId IS NULL OR flaggedForReview = true`) excludes AI-categorized transactions because they have a non-null `categoryId` and `flaggedForReview = false`.

**Updated candidate query:**

```typescript
where(
  and(
    eq(transactions.userId, userId),
    not(eq(transactions.isTransfer, true)),
    inArray(transactions.categorySource, [
      CATEGORY_SOURCE.DEFAULT,
      CATEGORY_SOURCE.AI,
    ])
  )
)
```

This is a clean simplification: explicitly target the two sources that should be overwritten by rules. Manual and rule-applied are implicitly excluded by not being in the array.

Update the function name from `fetchUncategorizedTransactions` to `fetchRuleApplicableTransactions` to reflect the expanded scope.

---

## Frontend changes

### `RuleSuggestionsPanel.tsx` (new component)

**Location:** `apps/web/src/features/config/components/RuleSuggestionsPanel.tsx`

A collapsible section rendered at the top of `RulesTab`, above the filter bar and rules table. Hidden entirely when there are no pending suggestions.

**Header:** "Suggested rules (N)" with a chevron toggle for collapse/expand. Expanded by default when suggestions are present.

**Body:** A table with columns:

| Column | Notes |
|---|---|
| Keyword | The `suggestedKeyword` |
| Category / Subcategory | Joined names |
| Need / Want | Pill badge; blank if null |
| Confidence | Percentage, e.g. `87%` |
| Actions | Accept · Edit & Accept · Dismiss |

**"Accept" action:** Calls `POST /rule-suggestions/:id/accept` with no body (uses the suggestion's stored values as-is). On success: removes the row from the panel, invalidates rule queries so the new rule appears in the table below.

**"Edit & Accept" action:** Opens `RuleEditModal` (from Phase A) pre-populated with the suggestion's fields. On modal save, calls `POST /rule-suggestions/:id/accept` with the edited values as the request body. On success: same as Accept.

**"Dismiss" action:** Calls `POST /rule-suggestions/:id/dismiss`. On success: removes the row from the panel.

**Empty state:** When the last suggestion is actioned, the panel collapses and disappears (remove from DOM, not just hidden).

---

### `useRuleSuggestions.ts` (new hook)

**Location:** `apps/web/src/features/config/hooks/useRuleSuggestions.ts`

```typescript
// Query
export function useRuleSuggestions(): UseQueryResult<RuleSuggestion[]>

// Mutations
export function useAcceptSuggestion(): UseMutationResult<Rule, Error, { id: string; input: AcceptSuggestionInput }>
export function useDismissSuggestion(): UseMutationResult<void, Error, string>
```

On success of either mutation: invalidate both `ruleSuggestionKeys.all()` and `ruleKeys.all()` (accept creates a new rule, so the rules list must refresh).

Query key factory:

```typescript
// apps/web/src/lib/queryKeys.ts — add:
export const ruleSuggestionKeys = {
  all: () => ['rule-suggestions'] as const,
};
```

---

### `RulesTab.tsx` — update

Add `RuleSuggestionsPanel` at the top:

```tsx
export function RulesTab() {
  const { data: suggestions = [] } = useRuleSuggestions();

  return (
    <div className="space-y-6">
      {suggestions.length > 0 && (
        <RuleSuggestionsPanel suggestions={suggestions} />
      )}
      {/* existing filter bar, sort controls, rules table */}
    </div>
  );
}
```

---

### `ImportResultCard.tsx` — update

When `result.suggestionCount > 0`, add a row to the results card:

```
Rule suggestions     3     (blue highlight)
```

Below the stats, add a hint text:

> "N rule suggestion(s) ready for review. Visit the Rules page to accept or dismiss them."

Link "Rules page" to `/config` (or the dedicated rules route if one exists). Do not show this hint when `suggestionCount === 0`.

---

## Edge cases

**`sourceName` is null:** Do not generate a suggestion. A null `sourceName` means the adapter didn't produce a clean merchant name and the raw description would make a poor keyword. The transaction is still AI-categorized normally.

**Suggestion for a keyword that already has an active rule:** The suggestion is still generated and stored. The user may want a different categorization or may dismiss it. The pipeline tries to apply rules before AI — if a rule already matched, `categorySource` would be `'rule'`, not `'ai'`, so this situation only arises if the existing rule uses a different keyword that didn't match.

**Category deleted after suggestion created:** `category_id` on the suggestion uses `ON DELETE SET NULL`. The suggestion remains in `pending` state with `categoryId = null`. The panel should handle this gracefully — show "(category removed)" rather than a blank, and require the user to re-select a category before accepting.

**Concurrent accept:** The `status = 'pending'` assertion in the service (with `ALREADY_ACTIONED` error) prevents double-accept if two tabs are open. The frontend should handle 409 by refreshing the suggestions list.

---

## Testing

### Backend

**`rule-suggestions.routes.test.ts`** — new integration test file:

- `GET /rule-suggestions` — returns empty array when no suggestions; returns pending suggestions with joined category names; does not return accepted/dismissed suggestions; scoped to authenticated user
- `POST /:id/accept` — creates a rule with suggestion values; returns 201 with the rule; marks suggestion accepted; suggestion no longer appears in GET
- `POST /:id/accept` with body overrides — created rule uses override values, not suggestion values
- `POST /:id/accept` where suggestion has `needWant: 'NA'` — created rule has `needWant: null`
- `POST /:id/accept` on already-accepted suggestion — returns 409
- `POST /:id/dismiss` — marks dismissed; no longer in GET; returns 204
- `POST /:id/dismiss` on already-dismissed — returns 409
- Ownership: 403 on another user's suggestion for both accept and dismiss

**`import.service.ts` tests** — verify `suggestionCount` in `ImportResult`:
- Import with AI enabled and high-confidence results → `suggestionCount > 0`
- Second import with same sourceName (pending suggestion exists) → no duplicate, `suggestionCount` does not double-count
- Import with AI disabled → `suggestionCount === 0`

**`transactions.service.ts` (Apply Rules)** — add test:
- AI-categorized transactions are updated when a matching rule exists after the Apply Rules extension

### Manual verification

1. Enable AI (`ENABLE_AI_CATEGORIZATION=true`), import a CSV with novel merchants
2. Verify `ImportResultCard` shows a non-zero suggestion count with the hint
3. Navigate to Rules page, verify the "Suggested rules" panel is visible and expanded
4. Accept one suggestion as-is — verify it appears in the rules table, panel row disappears
5. Edit & accept one suggestion — verify the edited values are stored in the rule
6. Dismiss one suggestion — verify it disappears from the panel
7. Re-import the same file — verify no new suggestions for the already-actioned keywords
8. Click Apply Rules — verify AI-categorized transactions from the original import are now updated with `categorySource = 'rule'`
