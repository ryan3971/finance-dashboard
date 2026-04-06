# Tags API — Deferred Issues

## Business Logic

### Tag name uniqueness is case-sensitive
**Files:** `apps/api/src/features/tags/tags.service.ts`, `apps/api/src/db/schema.ts`

The current unique constraint on `(userId, name)` and the pre-check in `createTag` both use exact text equality. This means a user can create `"Groceries"` and `"groceries"` as distinct tags, which is almost certainly unintended for a display label.

Fixing this requires a normalisation decision:

**Option A — Lowercase on write (simplest)**
- Strip and lowercase `input.name` in `createTag` before insert
- The pre-check and unique constraint then compare normalised values automatically
- Display name is stored lowercase; formatting is the client's responsibility

**Option B — Separate `nameLower` column**
- Store `name` (display casing) and `nameLower` (normalised) as separate columns
- Apply the unique constraint to `(userId, nameLower)` instead
- Pre-check queries against `nameLower`
- Preserves user's chosen casing in the response

**Option C — Case-insensitive collation / `citext`**
- Change the `name` column to `citext` (PostgreSQL case-insensitive text type)
- Unique constraint and equality comparisons become case-insensitive automatically
- Requires enabling the `citext` extension in a migration

**Trade-off:** Option A is the lowest effort. Option C is the most transparent at the DB level but adds a pg extension dependency. Option B is the most explicit but adds schema complexity for a minor gain.

Whichever option is chosen, the pre-check in `createTag` must be updated to match the normalisation strategy so the fast-path and the constraint stay in sync.
