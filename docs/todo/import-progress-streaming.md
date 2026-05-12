# Import Progress Streaming

Real-time progress reporting for the CSV import pipeline via Server-Sent Events (SSE).

## Problem

The import endpoint (`POST /api/v1/imports/upload`) is fully synchronous. The client uploads a file and blocks until the entire pipeline finishes. For a large CSV with AI categorization enabled — where each row makes an outbound API call — this can mean 60–200+ seconds of silence with no feedback beyond a generic spinner.

---

## Approach: SSE on the POST response

The client POSTs multipart form-data to a new endpoint (`POST /api/v1/imports/upload/stream`). Instead of a single JSON response at completion, the response body streams `text/event-stream` events as the import progresses, with the final event carrying the completed `ImportResult`.

The frontend reads the stream using `fetch` + a `ReadableStream` reader. The browser's native `EventSource` API cannot be used here because it only supports `GET` requests.

### Why not polling?

Polling a status endpoint (e.g. `GET /imports/:id/status`) would require writing intermediate counts to the DB on every row and introducing a polling interval. The existing `imports` table already stores final counts, but writing after each row adds N DB writes per import with no architectural benefit over SSE. SSE is strictly cheaper and more immediate.

### Backward compatibility

The existing `POST /upload` route is **not modified**. It continues to work identically and all existing tests and integration test helpers that call `processImport` directly are unaffected. The new streaming route is purely additive.

---

## Scope

**In scope:**
- New streaming upload route
- Per-row progress events with running counts and categorization method
- Stage events for parsing, transfer detection, and completion
- Frontend progress bar, stage label, live running counts, and per-row method badge

**Out of scope:**
- Pause/cancel/resume of an in-progress import
- Persisting per-row categorization method breakdown to the DB
- Retrying individual failed rows
- Progress on the existing sync `/upload` endpoint

---

## Shared types

**File:** `packages/shared/src/types/transactions.ts`

Add `ImportProgressEvent` as a discriminated union. All event shapes the server emits and the client reads must go through this type.

```typescript
export type ImportProgressEvent =
  | {
      stage: 'parsing';
      rowCount: number;
      institution: string;
    }
  | {
      stage: 'categorizing';
      processed: number;
      total: number;
      importedCount: number;
      flaggedCount: number;
      duplicateCount: number;
      errorCount: number;
      method: 'rule' | 'ai' | 'fallback';
    }
  | {
      stage: 'detecting_transfers';
    }
  | {
      stage: 'complete';
      result: ImportResult;
    }
  | {
      stage: 'error';
      message: string;
    };
```

`ImportResult` is unchanged.

---

## Backend

### `import.service.ts`

**Add an optional `onProgress` callback parameter to `processImport`.**

```typescript
type ImportProgressCallback = (event: ImportProgressEvent) => void;

export async function processImport(
  userId: string,
  accountId: string,
  filename: string,
  fileBuffer: Buffer,
  log: Logger = logger,
  onProgress?: ImportProgressCallback,    // ← new, optional, last param
): Promise<ImportResult>
```

The callback is called at four points in the existing pipeline:

**1. After adapter resolution and CSV parse** — emit `parsing`.

```typescript
onProgress?.({
  stage: 'parsing',
  rowCount: parsed.length,
  institution: account.institution,
});
```

**2. After each `processTransactionRow` call** — emit `categorizing` with running totals and the categorization method for the row just processed.

`processTransactionRow` currently returns `string | null` (the inserted transaction ID). To surface the method, it should also return the `categorySource` from the categorization result. Refactor the return type:

```typescript
// Before
async function processTransactionRow(...): Promise<string | null>

// After
async function processTransactionRow(
  ...
): Promise<{ id: string; method: 'rule' | 'ai' | 'fallback' } | null>
```

`categorySource` from `CategorizationResult` maps to `method` as:
- `'rule'` → `'rule'`
- `'ai'` → `'ai'`
- `'default'` → `'fallback'`

The `processAllRows` loop emits progress after each non-investment row:

```typescript
const row = await processTransactionRow(raw, accountId, importId, userId, rules, result);
if (row) importedTransactionIds.push(row.id);

onProgress?.({
  stage: 'categorizing',
  processed: rowIndex + 1,
  total: parsed.length,
  importedCount: result.importedCount,
  flaggedCount: result.flaggedCount,
  duplicateCount: result.duplicateCount,
  errorCount: result.errorCount,
  method: row?.method ?? 'fallback',
});
```

Investment rows (`isInvestmentTransaction`) do not have categorization — skip the `onProgress` call for those, or emit with `method: 'fallback'` if a unified progress bar is preferred.

**3. Before transfer detection** — emit `detecting_transfers`.

```typescript
onProgress?.({ stage: 'detecting_transfers' });
const transfers = await detectTransfers(importedTransactionIds, userId);
```

The `complete` event is **not** emitted by `processImport`. The route layer emits it after `processImport` returns, so the full `ImportResult` is available.

---

### `imports.routes.ts`

**Add `POST /upload/stream` alongside the existing `/upload`.**

```typescript
router.post(
  '/upload/stream',
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
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

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    function emit(event: ImportProgressEvent) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    try {
      const result = await processImport(
        userId,
        accountId,
        req.file.originalname,
        req.file.buffer,
        log,
        emit,
      );
      emit({ stage: 'complete', result });
    } catch (err) {
      emit({
        stage: 'error',
        message: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      res.end();
    }
  }
);
```

Note: Express 5 async handlers propagate rejections to error middleware automatically, but the SSE response is already open when an error occurs, so the try/catch here is intentional — we need to emit the error event to the client before ending the stream rather than letting Express's error handler touch the response.

---

## Frontend

### `useImportUpload.ts`

Replace the axios `POST` to `/imports/upload` with a `fetch` call to `/imports/upload/stream`. The hook gains a `progress` state field.

**New state:**

```typescript
const [progress, setProgress] = useState<ImportProgressEvent | null>(null);
```

**`handleSubmit` — replace the axios call:**

```typescript
const response = await fetch(`${config.apiBaseUrl}/imports/upload/stream`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${getAccessToken()}`,  // existing token helper
  },
  body: formData,
});

if (!response.ok || !response.body) {
  setError(await getApiErrorMessage(response));
  return;
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });

  // SSE lines are delimited by \n\n
  const parts = buffer.split('\n\n');
  buffer = parts.pop() ?? '';  // last partial chunk back into buffer

  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith('data: ')) continue;

    const event: ImportProgressEvent = JSON.parse(line.slice(6));
    setProgress(event);

    if (event.stage === 'complete') {
      setResult(event.result);
      queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
    } else if (event.stage === 'error') {
      setError(event.message);
    }
  }
}
```

**Auth note:** axios interceptors handle token attachment automatically. `fetch` does not. Use the same `getAccessToken()` utility already used elsewhere in the codebase (check `apps/web/src/lib/auth.ts` or similar). If no such utility exists, read the token from localStorage directly — the same source the axios interceptor reads from.

**Updated hook return value:**

```typescript
return {
  accountId,
  setAccountId,
  file,
  loading,
  result,
  error,
  progress,      // ← new
  fileInputRef,
  handleSubmit,
  handleFileChange,
  reset,
};
```

`reset()` should also clear `progress`.

---

### `ImportPage.tsx`

Replace the loading spinner with a structured progress section. Show it while `loading` is true and `result` is null.

**Stage label mapping:**

```typescript
const STAGE_LABELS: Partial<Record<ImportProgressEvent['stage'], string>> = {
  parsing: 'Reading file…',
  categorizing: 'Categorizing transactions…',
  detecting_transfers: 'Detecting transfers…',
};
```

**Progress bar:** Only show the percentage bar during `categorizing`, since that is the only stage where `processed` / `total` is known.

```typescript
const pct =
  progress?.stage === 'categorizing' && progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : null;
```

**Method badge:** Only meaningful during `categorizing`. Show it as a small inline indicator beside the stage label or beneath the progress bar.

```typescript
const METHOD_LABELS = {
  rule:     'Rule matched',
  ai:       'AI categorized',
  fallback: 'Uncategorized',
};
```

**Running counts:** During `categorizing`, show live counters for imported, flagged, and duplicates so the user can see the numbers accumulating rather than them appearing all at once at the end.

**Example layout during categorizing (wireframe):**

```
Categorizing transactions…
[████████████░░░░░░░░░░░░░░] 143 / 847   (AI categorized)

Imported   138     Flagged   12     Duplicates   3
```

**What to hide/show:**

| State | Show |
|---|---|
| `loading = false, result = null` | Upload form |
| `loading = true, progress = null` | Minimal spinner (file uploading, not yet streaming) |
| `progress.stage = 'parsing'` | Stage label + institution name |
| `progress.stage = 'categorizing'` | Stage label + progress bar + method badge + running counts |
| `progress.stage = 'detecting_transfers'` | Stage label (no progress bar) |
| `result != null` | `ImportResultCard` (unchanged) |

---

## Error handling

**Network failure during stream:** If the `fetch` rejects or the stream closes unexpectedly before a `complete` event, set a generic error (`setError('Connection lost during import')`) and set `loading = false`. The import may or may not have completed on the server — the `importId` is only available in the `complete` event, so partial recovery is not possible from the client. The user should re-import.

**Server error event:** If the server emits `{ stage: 'error', message }`, display `message` as the import error.

**HTTP 4xx before streaming starts:** The route returns a standard JSON error before calling `res.flushHeaders()` for validation failures (no file, bad accountId). The `fetch` response will have `response.ok = false`. Handle this before entering the stream reading loop.

**`importing` DB status stuck open:** If the server crashes mid-import, the `imports` row will remain in `status: 'processing'`. This is a pre-existing issue with the sync endpoint too — no change in behaviour, no fix required here.

---

## Testing

### Unit tests

- `processImport` receives the `onProgress` callback and calls it — mock the callback with `vi.fn()` and assert it was called with the expected sequence of events
- `processTransactionRow` return type change — update existing import route tests that check the return value

### Integration tests

The existing `imports.routes.test.ts` integration tests call `POST /upload` and are unaffected.

Add integration tests for `POST /upload/stream`:
- Successful import: parse the SSE response body, assert events arrive in order (`parsing` → N × `categorizing` → `detecting_transfers` → `complete`), assert final `ImportResult` fields
- Invalid accountId: assert `400` JSON response (stream never opens)
- No file: assert `400` JSON response

For SSE parsing in tests, split the response text on `\n\n` and parse each `data:` line — no special SSE library needed.

### Manual verification

1. Enable AI categorization (`ENABLE_AI_CATEGORIZATION=true`, valid `ANTHROPIC_API_KEY`)
2. Import a CSV with 50+ rows
3. Verify the progress bar advances row-by-row, method badge shows "AI categorized" for novel merchants and "Rule matched" for known ones
4. Verify final `ImportResultCard` matches the counts that accumulated in the live display
