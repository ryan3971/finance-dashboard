# Web — CLAUDE.md

Guidance specific to `apps/web`.

## Structure (`src/`)

- `features/` — Domain modules (auth, transactions, import, dashboard)
- `components/` — Reusable UI components
- `widgets/` — Dashboard chart/stat widgets
- `hooks/` — Custom React hooks
- `lib/` — Axios instance (`api.ts`), config, React Query keys (`queryKeys.ts`), localStorage keys (`storageKeys.ts`)
- `App.tsx` — Router setup and `AuthProvider`

## Constants

- **localStorage keys** — use `STORAGE_KEYS` from `@/lib/storageKeys` (`ACCESS_TOKEN`, `USER`). Never use the raw strings directly.
- **React Query keys** — use the key factories in `@/lib/queryKeys` (`transactionKeys`, `accountKeys`, `categoryKeys`, `tagKeys`). Never use raw arrays like `['tags']`.
- **Cross-app constants** (field limits, transfer keywords, default currency) — import from `@finance/shared`.

## Auth

Auth state (access token) lives in React Context (`AuthProvider`), not localStorage. The refresh token cookie is sent automatically by the browser.

## Dev proxy

Vite proxies `/api` to `localhost:3001` in dev.
