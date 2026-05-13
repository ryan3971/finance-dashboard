# Rules Page Overhaul

Adds filtering, sorting, category grouping, full field editing via modal, and wildcard keyword matching to the categorization rules feature.

## Problem

The current rules tab (`RulesTab.tsx`) is a minimal inline-edit table. It has no filtering or search, no sorting beyond the default priority/createdAt order, no ability to edit category or subcategory (despite the PATCH endpoint supporting it), and keyword matching is a plain substring check with no user-facing control over match behaviour.

---

## Scope

**In scope:**
- Filter/search bar: by keyword, category, subcategory
- Sort controls on all meaningful columns: keyword (A–Z), category name (A–Z), priority (high–low, low–high), creation date (newest–oldest)
- Visual grouping of rules by top-level category
- Full field editing via a modal (replaces inline edit): keyword, category/subcategory, priority, needWant, flagForReview, matchType
- Wildcard matching: `*` (any characters) and `?` (one character) as an opt-in match type
- `matchType` propagated from DB → API → shared type → UI

**Out of scope:**
- Drag-to-reorder priority (the numeric priority field is sufficient)
- Rule enable/disable toggle (no `isActive` field, not worth adding)
- Rule usage/frequency tracking
- Bulk actions (bulk delete, bulk accept)

---

## Schema changes

**Migration:** Add `matchType` column to `categorization_rules`.

```sql
ALTER TABLE categorization_rules
  ADD COLUMN match_type text NOT NULL DEFAULT 'substring'
  CHECK (match_type IN ('substring', 'wildcard'));
```

**Drizzle schema** (`apps/api/src/db/schema.ts`):

```typescript
matchType: text('match_type', { enum: ['substring', 'wildcard'] })
  .notNull()
  .default('substring'),
```

All existing rules default to `'substring'` — no behaviour change on migration.

---

## Shared types

**File:** `packages/shared/src/schemas/rules.ts`

Add `matchType` to the existing `patchRuleSchema`:

```typescript
import { z } from 'zod';

export const patchRuleSchema = z.object({
  keyword:      z.string().min(1).max(200).optional(),
  categoryId:   z.string().uuid().nullable().optional(),
  subcategoryId:z.string().uuid().nullable().optional(),
  priority:     z.number().int().optional(),
  needWant:     z.enum(['Need', 'Want']).nullable().optional(),
  flagForReview:z.boolean().optional(),
  matchType:    z.enum(['substring', 'wildcard']).optional(),  // ← new
});
```

Add a `createRuleSchema` if one does not already exist (for `POST` — not currently in the API, but it should be):

```typescript
export const createRuleSchema = z.object({
  keyword:       z.string().min(1).max(200),
  categoryId:    z.string().uuid().nullable(),
  subcategoryId: z.string().uuid().nullable().optional(),
  priority:      z.number().int().default(5),
  needWant:      z.enum(['Need', 'Want']).nullable().optional(),
  flagForReview: z.boolean().default(false),
  matchType:     z.enum(['substring', 'wildcard']).default('substring'),
  sourceName:    z.string().nullable().optional(),
});
```

**File:** wherever the `Rule` response type is defined (check `packages/shared/src/types/` or the return type of `listRules`):

```typescript
export interface Rule {
  id:            string;
  keyword:       string;
  sourceName:    string | null;
  categoryId:    string | null;
  categoryName:  string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  needWant:      'Need' | 'Want' | null;
  flagForReview: boolean;
  priority:      number;
  matchType:     'substring' | 'wildcard';  // ← new
  createdAt:     string;
}
```

---

## Backend changes

### `rules-engine.ts` — wildcard dispatch

`applyRules` currently uses a plain `.includes()` check. Replace the match check with a dispatch on `matchType`. `LoadedRule` gains `matchType` automatically since it is `Omit<Rule, 'createdAt'>` and the schema now includes it.

```typescript
function descriptionMatchesRule(description: string, rule: LoadedRule): boolean {
  const normDesc    = description.toLowerCase();
  const normKeyword = rule.keyword.toLowerCase();

  if (rule.matchType === 'wildcard') {
    // Escape all regex metacharacters except * and ?, then convert wildcards.
    const escaped = normKeyword.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const pattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(pattern).test(normDesc);
  }

  return normDesc.includes(normKeyword);
}
```

Replace the existing `.includes()` call in the loop with `descriptionMatchesRule(description, rule)`. No other changes to `applyRules`.

Note: `RegExp` is constructed per rule-match call. Rule sets are small (< 200 per user) and imports are not real-time latency-critical, so pre-compilation is not warranted.

### `categorization-rules.routes.ts` — add `POST /` and update existing handlers

**New endpoint: `POST /api/v1/categorization-rules`**

Creates a new rule for the authenticated user. Validated with `createRuleSchema`.

Request body:

```typescript
{
  keyword:       string;          // required, 1–200 chars
  categoryId:    string | null;   // required (nullable for flag-for-review rules)
  subcategoryId?: string | null;
  priority?:     number;          // integer, defaults to AUTO_RULE_PRIORITY (5)
  needWant?:     'Need' | 'Want' | null;
  flagForReview?: boolean;        // defaults to false
  matchType?:    'substring' | 'wildcard';  // defaults to 'substring'
  sourceName?:   string | null;
}
```

Service function: `createRule(userId, input)` — inserts a row into `categorization_rules` with `userId` set to the authenticated user, returns the full rule object (same shape as `listRules` rows, including joined `categoryName`/`subcategoryName`).

Response: `201` with the created `Rule`.

**`PATCH /:id`** — already accepts `categoryId` and `subcategoryId`. Adding `matchType` to `patchRuleSchema` is sufficient — the route passes the validated body to `updateRule`, which writes whatever fields are present.

Verify that the `select` in `listRules`, the `returning` clause in `updateRule`, and the `returning` clause in `createRule` all include the new `matchType` column.

### `categorization-rules.service.ts`

Add `createRule(userId, input)` alongside the existing `listRules`, `updateRule`, and `deleteRule`. Add `matchType` to the select list in `listRules` and the returning clause in `updateRule` so it is returned in every rule response.

### Test file (`categorization-rules.routes.test.ts`)

Add cases for the new `POST /`:
- Creates a rule and returns `201` with all fields including `matchType: 'substring'` (default)
- Creates a rule with `matchType: 'wildcard'` — persisted and returned correctly
- Missing `keyword` returns `400`
- `keyword` exceeding 200 chars returns `400`
- Invalid `matchType` value returns `400`
- Auth: `401` without token
- Isolation: rule is scoped to the authenticated user; another user's `GET` does not return it

Add cases for the updated `PATCH /:id`:
- `PATCH /:id` with `matchType: 'wildcard'` — verify it persists and is returned
- `PATCH /:id` with invalid `matchType` value — verify `400`

Add case for `GET /`:
- Existing rules (seeded before this migration) have `matchType: 'substring'` in response

---

## Frontend changes

### `RuleEditModal.tsx` (new component)

**Location:** `apps/web/src/features/config/components/RuleEditModal.tsx`

A modal (using the existing shadcn `Dialog`) containing the full edit form. Used for both editing existing rules and creating new ones. Replaces the inline edit rows in `RulesTab`.

**Props:**

```typescript
interface RuleEditModalProps {
  rule?: Rule;          // undefined = create mode
  onClose: () => void;
  onSave: (input: PatchRuleInput | CreateRuleInput) => Promise<void>;
}
```

**Fields:**

| Field | Control | Notes |
|---|---|---|
| Keyword | `<Input>` | Monospace font |
| Match type | Two-button toggle: "Contains" / "Wildcard" | Defaults to "Contains"; toggling to "Wildcard" shows a short hint: `* matches anything, ? matches one character` |
| Category | `<CategorySelect>` (existing reusable component) | |
| Subcategory | Rendered by `CategorySelect` when a parent is selected | |
| Need / Want | Existing segmented button group pattern | Disabled and coerced to null for income categories |
| Flag for review | Checkbox | When checked, category/needWant fields are hidden |
| Priority | `<Input type="number">` | Integer, defaults to 5 |

**Wildcard preview (nice-to-have):** A live `matches / does not match` indicator against the rule's `sourceName` if one is set. Low priority — omit if it complicates the first pass.

**Validation:** Mirror `patchRuleSchema` — keyword non-empty after trim, priority is integer, `categoryId` required if `flagForReview` is false.

**Form library:** React Hook Form + Zod resolver, consistent with `TransactionReviewPanel`.

### `RulesTab.tsx` — overhaul

**Replace inline edit with modal.** Remove the `isEditing` state and the inline `<Input>` fields from `RuleRow`. The edit button opens `RuleEditModal`. Row hover still shows Edit / Delete buttons.

**Filter/search bar.** A single `<Input>` at the top with a search icon. Filters the displayed rules client-side by keyword substring or category name. No debounce needed — the rule set is small.

**Sort controls.** Column header buttons (or a `<Select>` dropdown) to sort by:

| Option | Sort key |
|---|---|
| Keyword A–Z | `keyword` ascending |
| Keyword Z–A | `keyword` descending |
| Category A–Z | `categoryName` ascending |
| Priority ↑ | `priority` descending (highest first — current default) |
| Priority ↓ | `priority` ascending |
| Newest first | `createdAt` descending |
| Oldest first | `createdAt` ascending |

Sorting is computed client-side from the query cache — no API changes needed.

**Group by category.** A toggle button ("Group by category") that, when active, renders rules grouped under their `categoryName` heading. Rules with no category (`categoryId: null`) appear under an "Uncategorized" group. Each group is collapsible (simple `<details>` or a chevron toggle). Grouping is applied after filtering but before/independent of the current sort.

**Columns to display:**

| Column | Notes |
|---|---|
| Keyword | Monospace; show wildcard badge if `matchType = 'wildcard'` |
| Category / Subcategory | `Category > Subcategory` format; dash if unset |
| Match type | Only shown as a badge — not a separate column; inline on keyword |
| Need / Want | Pill badge; blank if null |
| Flag for review | Checkmark icon if true |
| Priority | Number |
| Actions | Edit / Delete (hover-reveal) |

**CSV export update.** Add `matchType` column to the CSV export.

**Create rule button.** The existing "Add rule" button (or a new one if absent) opens `RuleEditModal` in create mode. On save, calls `POST /api/v1/categorization-rules` and invalidates `ruleKeys.all()`.

---

## Wildcard UX notes

- Display `matchType` inline in the keyword cell as a small `W` badge or `wildcard` chip so users can distinguish at a glance without opening the edit modal
- In the filter/search bar, wildcard syntax is NOT used — the search is always a plain substring match on the displayed data
- The hint text in the modal ("* matches anything, ? matches one character") is the only documentation needed; no separate help page

---

## Testing

### Backend (rules-engine.ts)
Extend `rules-engine.test.ts`:
- `matchType: 'wildcard'` — `AMAZON*` matches `AMAZON PRIME`, does not match `WHOLE FOODS`
- `matchType: 'wildcard'` — `STARBUCKS ???` matches `STARBUCKS #12` (7 chars), no match for `STARBUCKS #1234`
- `matchType: 'wildcard'` — `*TRANSFER*` matches `INTERAC E-TRANSFER DEBIT` 
- `matchType: 'substring'` (default) — existing tests unchanged
- Special regex characters in wildcard keywords are escaped: `AMAZON.CA` does not accidentally match `AMAZONXCA`

### Backend (routes)
Extend `categorization-rules.routes.test.ts`:
- `PATCH /:id` with `matchType: 'wildcard'` persists and is returned in GET
- Invalid `matchType` returns 400
- GET returns `matchType` on all rules

### Frontend
The inline edit removal and modal introduction are the most disruptive change — verify:
- Create, edit, and delete all work via the modal
- Filter, sort, and grouping work independently and in combination
- Wildcard badge appears correctly
