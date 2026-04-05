# Web — CLAUDE.md

Guidance specific to `apps/web`.

## Structure (`src/`)

- `features/` — Domain modules (auth, transactions, import, dashboard)
- `components/` — Reusable UI components
- `widgets/` — Dashboard chart/stat widgets
- `hooks/` — Custom React hooks
- `lib/` — Axios instance (`api.ts`), config, React Query keys (`queryKeys.ts`), localStorage keys (`storageKeys.ts`)
- `router.tsx` — Route tree, typed router context, `requireAuth` guard, search param schemas
- `main.tsx` — Entry point; `AuthProvider`, `RouterWrapper` (syncs auth context into router), `ErrorBoundary`

## Constants

- **localStorage keys** — use `STORAGE_KEYS` from `@/lib/storageKeys` (`ACCESS_TOKEN`, `USER`). Never use the raw strings directly.
- **React Query keys** — use the key factories in `@/lib/queryKeys` (`transactionKeys`, `accountKeys`, `categoryKeys`, `tagKeys`). Never use raw arrays like `['tags']`.
- **Cross-app constants** (field limits, transfer keywords, default currency) — import from `@finance/shared`.

## Auth

Auth state (access token) lives in React Context (`AuthProvider`), not localStorage. The refresh token cookie is sent automatically by the browser.

## React conventions

When mapping over a list that renders multiple sibling elements per item, use `<Fragment key={...}>` (named import from `react`) instead of `<>`. The shorthand `<>` does not accept a `key` prop.

## Forms

All forms use **React Hook Form** with a **Zod resolver**. The pattern:

1. Define the schema in `packages/shared/src/schemas/` and export it from the shared index — this lets the API and web share the same schema with no duplication.
2. `useForm<T>({ resolver: zodResolver(schema), defaultValues: { ... } })`
3. Spread `register('field')` directly onto `<Input>` and `<Select>` — both forward refs and accept all HTML attributes, so no wrapper needed.
4. Use `Controller` only for non-native inputs (custom pickers, third-party components).
5. Pass `formState.errors.field?.message` to `<FormField>`'s `error` prop for inline display.
6. Keep server/API errors in a separate `useState` — they are a different concern from field validation and should not go into RHF's error state.

Do not use `useState` per field for form inputs. Do not mix controlled `value`/`onChange` state with `register` on the same field.

Not everything with inputs is a form. Components that fire mutations directly on click (no submit), or filter bars driven by parent state, do not need RHF.

## Dev proxy

Vite proxies `/api` to `localhost:3001` in dev.
