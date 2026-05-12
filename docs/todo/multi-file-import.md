# Multi-File Import

Allow uploading several CSV files in a single request, all assigned to the same account. Each file produces its own `ImportResult` and the endpoint returns an array.

---

## Scope

**In scope:**
- Accept up to 10 files per request (configurable via the multer limit)
- Process files sequentially to keep DB and AI categorization load bounded
- Return `ImportResult[]` — one entry per file, in upload order
- Each file gets its own `imports` row and its own transfer-detection pass

**Out of scope:**
- Uploading files to different accounts in one request
- A merged/aggregated summary result across all files
- Parallel file processing
- Changes to the existing single-file `/upload` endpoint

---

## Backend

### `imports.routes.ts`

**Files:** `apps/api/src/features/imports/imports.routes.ts`

1. Change `upload.single('file')` → `upload.array('files', 10)`
2. Read `req.files` (typed as `Express.Multer.File[]`) instead of `req.file`
3. Validate the array is non-empty
4. Call `processImport` for each file sequentially, collecting results
5. Return `201` with `ImportResult[]`

```typescript
router.post(
  '/upload',
  upload.array('files', 10),
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }

    const body = z.object({ accountId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'accountId must be a valid UUID' });
      return;
    }

    const { accountId } = body.data;
    const { id: userId } = getAuthUser(req);
    const log = req.log.child({ userId });

    const results: ImportResult[] = [];
    for (const file of files) {
      const result = await processImport(userId, accountId, file.originalname, file.buffer, log);
      results.push(result);
    }

    res.status(201).json(results);
  }
);
```

### `import.service.ts`

No changes required. `processImport` is already a pure single-file function and can be called multiple times from the route.

---

## Error handling

**Hard errors** (bad `accountId`, no adapter, empty file): `processImport` throws. Because these indicate a misconfigured request rather than a per-file data problem, let the error propagate — Express 5 will forward it to the global error handler and the entire batch fails with the appropriate HTTP status.

**Row-level errors**: Already recorded in `result.errors` without throwing, so partial-success files are included in the response array normally.

**Decision:** Do not implement partial batch recovery (skip one failed file and continue). If a hard error occurs, the client should fix the request and retry all files. The alternative — per-file try/catch with a sentinel error shape in the results array — adds complexity with little benefit given the expected failure modes.

---

## Frontend

### API client

Update the import API call to send `files` (multi-value field) instead of `file`:

```typescript
// Before
formData.append('file', file);

// After
files.forEach(file => formData.append('files', file));
```

Expect `ImportResult[]` in the response instead of `ImportResult`.

### `ImportPage.tsx` / `useImportUpload.ts`

- Allow selecting multiple files (add `multiple` to the `<input type="file">`)
- Track `files: File[]` instead of `file: File | null`
- After a successful upload, display one `ImportResultCard` per file (or a summary table)

---

## Shared types

No new types needed — the endpoint response is `ImportResult[]` and `ImportResult` is unchanged.

---

## Testing

Update `imports.routes.test.ts`:

- **Single file** — existing tests should continue to pass if the field name changes from `file` → `files`; update the test helper to use `.attach('files', ...)` 
- **Multiple files** — upload 2–3 fixture CSVs in one request, assert response is an array with one result per file and correct counts
- **No files** — assert `400`
- **One bad file type** — multer's `fileFilter` rejects it; assert multer error propagates as expected
