# Web — CLAUDE.md

Guidance specific to `apps/web`.

## Structure (`src/`)

- `features/` — Domain modules (auth, transactions, import, dashboard)
- `components/` — Reusable UI components
- `widgets/` — Dashboard chart/stat widgets
- `hooks/` — Custom React hooks
- `App.tsx` — Router setup and `AuthProvider`

## Auth

Auth state (access token) lives in React Context (`AuthProvider`), not localStorage. The refresh token cookie is sent automatically by the browser.

## Dev proxy

Vite proxies `/api` to `localhost:3001` in dev.
