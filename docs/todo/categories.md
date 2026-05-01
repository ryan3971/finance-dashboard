# Categories — Deferred Issues

## Design

### Misleading error code when `isIncome` is missing on top-level category create
**Files:** `apps/api/src/features/categories/categories.service.ts`

When `createCategory` is called without `isIncome` for a top-level category (no `parentId`), it throws `INVALID_PARENT` (400):

```ts
if (input.isIncome === undefined) {
  throw new CategoryError(CategoryErrorCode.INVALID_PARENT);
}
```

The resulting error message — "Parent must be a top-level category owned by you" — is misleading in this context. A dedicated `MISSING_INCOME_FLAG` or generic `VALIDATION_ERROR` code with a clear message would be more accurate.

---

## Minor

### Fragile name-based ID mapping in `seedUserCategories`
**Files:** `apps/api/src/db/seeds/categories.ts`

After bulk-inserting the user's top-level categories, the function maps old system IDs to new user IDs by matching on `name`:

```ts
const original = topLevel.find((c) => c.name === row.name);
if (original) idMap.set(original.id, row.id);
```

This relies on the assumption that top-level system category names are unique. It's currently true, but a future duplicate in `SYSTEM_CATEGORIES` would cause subcategories to map to the wrong parent silently.

**Options:**
- Add a uniqueness assertion over `SYSTEM_CATEGORIES` at seed startup.
- Or use an insert-order correlation (e.g. insert one row at a time and capture the returned ID alongside the original).
