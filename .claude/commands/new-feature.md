# New Feature Planning

Before writing any code, complete this checklist in order. Do not skip sections. Answer each question explicitly — vague or partial answers are not acceptable.

## 1. Feature Definition

State in one sentence what the feature does and who benefits from it.

- What input does it take?
- What output or side effect does it produce?
- What are the explicit boundaries — what is out of scope?

---

## 2. Layer Impact Assessment

Work top-down. For each layer, state whether it is affected and what changes.

### Database
- Are new tables, columns, or indexes required? If so, list them and their types.
- Does any existing migration need updating, or is a new migration file needed?
- Are there foreign key relationships to other tables? Which cleanup order applies?
- Does the change affect the test DB (`finance_test`)? Run `pnpm --filter api db:migrate:test` after migrating dev.

### `packages/shared`
- Are new Zod schemas or TypeScript types required?
- If a literal value (constant) must be consistent across API and web, does it belong in `constants.ts`?
- Use sub-path imports only (`@finance/shared/schemas/...`, `@finance/shared/types/...`, `@finance/shared/constants`). Never the bare package root.

### API — DB layer
What does the DB query return? (summary numbers / grouped sums — never raw transaction rows to the dashboard layer)

### API — Service layer
What business logic does the service apply to the aggregated values? (percentage splits, derived fields, rebalancing offsets — no reformatting for the client)

### API — Route / Controller
- What is the endpoint shape (`METHOD /path`)?
- What are the query parameters, and do they filter the same response shape or imply a different endpoint?
- Does the new endpoint belong on an existing router or does it need a new one?

### Web — Data fetching
- Which TanStack Query keys are added or invalidated?
- Which API client function is added?

### Web — UI components
- Which existing components are reused, extended, or replaced?
- Are new components needed? If so, where do they live in the file tree?
- Is routing affected? (new route, nested route, redirect)

---

## 3. Dashboard Layer Rules (if this is a dashboard feature)

Answer all three before touching any file:

1. What does the DB query return?
2. What does the service layer do with it?
3. What shape does the API response have?

The client layer may only format numbers, derive percentages from returned totals, and decide colour states. It must never re-aggregate raw data.

---

## 4. Tests Required

List every test that must be written or updated. Be specific about file paths and what each test covers.

**API integration tests** (`apps/api/src/features/<feature>/<feature>.routes.test.ts`):
- Happy path (expected inputs → expected response shape)
- Auth guard (unauthenticated request returns 401)
- Validation errors (missing or invalid params return 400)
- Edge cases specific to this feature

**Service / unit tests** (if the service logic is non-trivial):
- Each branch of business logic

**Migration test**: After writing the migration, run `pnpm --filter api db:migrate:test` and confirm no errors.

**Manual smoke test**: Start `pnpm dev` and verify the golden path end-to-end in the browser before declaring done.

---

## 5. Type Safety

- No type assertions (`as SomeType`) — fix the type at its source, use a type guard, or parse with Zod.
- No barrel files inside `apps/api` or `apps/web`.
- After adding a new export or changing an import, restart the TS server if the language server shows unexpected errors before investigating further.

---

## 6. Documentation Updates

Check each item:

- [ ] Root `CLAUDE.md` — does anything in the Shared Conventions, Dashboard Layer Responsibilities, or Tooling sections need updating?
- [ ] `apps/api/CLAUDE.md` — new endpoint, service pattern, or DB constraint worth capturing?
- [ ] `apps/web/CLAUDE.md` — new component pattern, query key convention, or routing change?
- [ ] `docs/` — does any existing doc cover this feature area? Update it rather than creating a new file.
- [ ] Bruno collection (`bruno/`) — add a request for every new endpoint so the collection stays the source of truth for manual API testing.

---

## 7. Implementation Order

List files to create or edit in the order they should be touched, so each step compiles cleanly before moving to the next:

1. Migration (if schema changes)
2. Shared schemas / types
3. DB query function
4. Service function
5. Route handler + Zod request validation
6. API client function (web)
7. TanStack Query hook (web)
8. UI component(s)
9. Tests
10. Documentation updates

Do not proceed past step N until step N compiles and its tests pass.
