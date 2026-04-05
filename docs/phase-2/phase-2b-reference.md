# Phase 2B Reference — Frontend UI

**Date completed:** 2026-03-30
**Prerequisite:** Phase 2A backend (65/65 tests passing)

---

## What Was Built

Phase 2B is a pure frontend layer on top of the Phase 2A API. No backend changes. No new API endpoints. It adds:

| Feature | What it does |
|---|---|
| Navigation shell | Persistent top bar on all authenticated pages |
| Transaction filters | Filter by account, date range, category, flagged status |
| Review queue | Inline edit panel for flagged transactions |
| Category override | Change category/subcategory + need/want + note on any transaction |
| Save-as-rule | Checkbox that tells the API to create a categorization rule for future imports |
| Transfer confirmation | Confirm or dismiss transfer detection directly from the review panel |
| Tags | Create, attach, detach colour-coded tags on any transaction row |
| Import page | Upload a CSV/XLSX file, pick an account, see a result summary |

---

## How to Run the Full Stack

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker Desktop running

### Steps

```bash
# 1. Start the database
docker compose up postgres -d

# 2. (First time only) Run migrations
pnpm --filter api db:migrate

# 3. Start the API server (runs on http://localhost:3000)
pnpm --filter api dev

# 4. In a separate terminal, start the web app (runs on http://localhost:5173)
pnpm --filter web dev
```

Open [http://localhost:5173](http://localhost:5173). Register an account, then import a CSV file from `packages/shared/fixtures/` to populate data.

### Type check (must pass before committing)
```bash
pnpm typecheck
```

---

## File Map

### Pages (`apps/web/src/pages/`)

| File | Route | What it does |
|---|---|---|
| `TransactionsPage.tsx` | `/` | Main transaction list with filters, review panel, tags |
| `ImportPage.tsx` | `/import` | File upload form + result summary |
| `LoginPage.tsx` | `/login` | Email/password login |
| `RegisterPage.tsx` | `/register` | Account creation |

### Components (`apps/web/src/components/`)

| File | Used by | What it does |
|---|---|---|
| `NavBar.tsx` | `PageLayout` | Top navigation bar with links and logout button |
| `PageLayout.tsx` | Both pages | Wraps each authenticated page: NavBar + centred content area |
| `TransactionFilters.tsx` | `TransactionsPage` | Row of filter controls (account, dates, category, flagged toggle) |
| `CategorySelect.tsx` | `TransactionReviewPanel` | Two linked dropdowns: parent category then subcategory |
| `TransactionReviewPanel.tsx` | `TransactionsPage` | Inline edit form that slides open below a flagged transaction row |
| `TransactionTagsPanel.tsx` | `TransactionsPage` | Tag chips on each row with add/remove/create controls |
| `ProtectedRoute.tsx` | `App.tsx` | Redirects unauthenticated users to `/login` |

### Hooks (`apps/web/src/hooks/`)

| File | What it does |
|---|---|
| `useTransactions.ts` | Fetches the paginated transaction list; accepts all filter params |
| `useCategories.ts` | Fetches the full category tree (cached 30 min) |
| `useAccounts.ts` | Fetches the user's accounts (cached 10 min) |
| `useTags.ts` | Fetches all tags; mutations for create/delete/attach/detach |
| `useTransactionMutations.ts` | Mutations for PATCH transaction, confirm transfer, dismiss transfer |

### Other (`apps/web/src/`)

| File | What it does |
|---|---|
| `App.tsx` | Router — declares all routes, wraps in `AuthProvider` |
| `lib/api.ts` | Axios instance — handles auth tokens and 401 refresh |
| `contexts/AuthContext.tsx` | React context for login state, user object, logout callback |

---

## Data Flow — How It All Connects

The pattern is the same everywhere:

```
API endpoint  →  custom hook (React Query)  →  component renders data / triggers mutations
```

### Example: Editing a transaction's category

1. User clicks **Review** on a flagged row in `TransactionsPage`
2. `TransactionReviewPanel` opens inline (rendered as a second `<tr>` in the same table)
3. User picks a new category using `CategorySelect` (which calls `useCategories`)
4. User clicks **Save** — `usePatchTransaction().mutateAsync()` fires
5. That calls `PATCH /api/v1/transactions/:id` via the `api` axios instance
6. On success, React Query **invalidates** the `['transactions']` cache key
7. `useTransactions` automatically re-fetches, the row updates with the new category

### Example: Importing a file

1. User visits `/import`, selects an account and picks a file
2. `ImportPage` posts `FormData` to `POST /api/v1/imports/upload`
3. On success, it invalidates `['transactions']` so the list is fresh
4. The result summary shows counts from the API response

---

## API Endpoints the Frontend Calls

All calls go through the `api` axios instance (`apps/web/src/lib/api.ts`), which prepends `/api/v1` and attaches the auth token automatically.

| Method | Path | Used by |
|---|---|---|
| `GET` | `/transactions` | `useTransactions` |
| `PATCH` | `/transactions/:id` | `usePatchTransaction` |
| `POST` | `/transactions/:id/tags` | `useAttachTag` |
| `DELETE` | `/transactions/:id/tags/:tagId` | `useDetachTag` |
| `GET` | `/categories` | `useCategories` |
| `GET` | `/accounts` | `useAccounts` |
| `GET` | `/tags` | `useTags` |
| `POST` | `/tags` | `useCreateTag` |
| `DELETE` | `/tags/:id` | `useDeleteTag` |
| `POST` | `/transfers/confirm` | `useConfirmTransfer` |
| `POST` | `/transfers/dismiss` | `useDismissTransfer` |
| `POST` | `/imports/upload` | `ImportPage` |
| `POST` | `/auth/logout` | `NavBar` |

---

## Key Patterns Used

### React Query (TanStack Query v5)

React Query is a data-fetching and caching library. You don't write `useEffect` + `fetch` manually — instead you declare a `queryKey` (a cache identifier) and a `queryFn` (what to fetch), and the library handles loading states, caching, and re-fetching.

```typescript
// Reading data
const { data, isLoading, isError } = useQuery({
  queryKey: ['transactions', { page, accountId }],  // cache key — changes trigger re-fetch
  queryFn: async () => {
    const { data } = await api.get('/transactions', { params: { page, accountId } });
    return data;
  },
});

// Writing data
const mutation = useMutation({
  mutationFn: async (input) => api.patch(`/transactions/${input.id}`, input),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  // invalidateQueries tells React Query: "this cache is stale, re-fetch it"
});
await mutation.mutateAsync({ id: '...', categoryId: '...' });
```

### Tailwind CSS

Tailwind is a utility-first CSS framework — there are no `.css` files, just class names applied directly to elements. Every class maps to a single CSS rule:

```tsx
<button className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 disabled:opacity-40">
  Save
</button>
// px-4 = padding-left/right: 1rem
// bg-gray-900 = dark background
// hover:bg-gray-800 = slightly lighter on hover
// disabled:opacity-40 = faded when button is disabled
```

### Axios instance with interceptors (`lib/api.ts`)

Rather than using `fetch` directly, all requests go through a pre-configured `axios` instance. It automatically:
- Attaches the `Authorization: Bearer <token>` header from localStorage
- On a 401 response, attempts a token refresh before retrying the original request
- On failed refresh, clears auth state and redirects to login

This means every hook and component can call `api.get(...)` without worrying about auth.

### React Router v6

Routes are declared in `App.tsx`. `ProtectedRoute` is a wrapper component that checks auth state — if the user isn't logged in, it redirects to `/login` instead of rendering the page.

```tsx
<Route path="/" element={
  <ProtectedRoute>
    <TransactionsPage />
  </ProtectedRoute>
} />
```

---

## Transfer Detection

The backend flags transfers during import. The `TransactionReviewPanel` shows transfer-specific actions when the transaction is flagged and the description contains keywords like `tfr`, `transfer`, `e-tfr`, or `payment`.

- **Confirm transfer** → calls `POST /transfers/confirm` → the transaction is marked `isTransfer: true` and excluded from income/expense totals
- **Not a transfer** → calls `POST /transfers/dismiss` → the flag is cleared and the transaction is treated as a normal expense

---

## What Phase 3 Will Add

Phase 3 is expected to build on top of this foundation with analytics dashboards (the `recharts` library is already installed). The `apps/web/src/dashboards/` directory is the intended home for those components.
