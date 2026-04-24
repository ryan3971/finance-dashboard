You are performing a comprehensive code review of the `packages/shared` workspace of a TypeScript monorepo. This package is the single source of truth for Zod schemas, TypeScript types, and shared constants consumed by both `apps/api` (Express 5 REST API) and `apps/web` (React 18 SPA). Nothing in this package should contain runtime logic specific to either app.
## Codebase Structure
- `src/constants.ts` — shared literals (account types, transfer keywords, category sources, etc.) that must be consistent across both apps
- `src/schemas/` — Zod validation schemas: accounts, anticipated-budget, auth, categories, rebalancing, rules, tags, transactions, user-config
- `src/types/` — TypeScript type definitions: adapters, anticipated-budget, auth, categories, dashboard, rebalancing, rules, transactions, user-config
## Import Rules (both apps must follow these)
```typescript
// Correct sub-path imports
import { loginSchema } from '@finance/shared/schemas/auth';
import type { Transaction } from '@finance/shared/types/transactions';
import { ACCOUNT_TYPE_ORDER } from '@finance/shared/constants';
// Forbidden — bare package root
import { loginSchema } from '@finance/shared';
Architecture Rules to Enforce
No app-specific logic — this package must have zero imports from apps/api or apps/web. No Express types, no React types, no browser APIs, no Node-only APIs (unless polyfilled or behind a check).
No barrel files — no intermediate schemas/index.ts or types/index.ts that re-export everything. The flat boundary barrel is acceptable only at the package root if one exists.
Zod schemas are the source of truth — TypeScript types in types/ must be derived from Zod schemas using z.infer<typeof schema> wherever practical. Manually maintained parallel types that can drift from schemas are a defect.
Constants belong here if shared — any literal value that must be consistent across both apps belongs in constants.ts. Duplicating them in apps/api/src/lib/constants.ts or inline in the web is a violation.
No type assertions — avoid as SomeType. Fix the type gap at source.
Schema completeness — schemas must cover all fields the API sends and the web consumes. Missing optional fields in schemas cause silent undefined bugs at runtime.
No runtime side effects — this package is imported in both environments. Files must not execute side effects at import time (no console.log, no process.exit, no global mutations).
Review Checklist
Schema Correctness
Are all Zod schemas accurately reflecting the actual database column types and API response shapes? Look for:
z.string() used where z.number() or z.coerce.number() is needed
Missing .optional() or .nullable() on fields that can be absent/null
Incorrect enum values (check against constants.ts — enums should reference constants, not duplicate string literals)
Date fields using z.string() where z.coerce.date() would be safer
Monetary/numeric fields returned as strings from Drizzle numeric columns — schemas should reflect the actual wire format (string), not the desired JS type
Are request body schemas (e.g., createTransactionSchema) distinct from response schemas where the shapes differ? They must not be the same object if the API strips or adds fields.
Are schemas for paginated responses wrapping results in a consistent shape (e.g., { data: T[], total: number, page: number, pageSize: number })?
Type Accuracy
Are types in types/ derived with z.infer from their corresponding schema? If a type is manually written, does it match the schema exactly?
Are dashboard response types in types/dashboard.ts complete — do they include all fields the API service computes and the web client reads?
Are union types and discriminated unions used where appropriate (e.g., different transaction categories, account types)?
Are there any types anywhere? Each one is a contract hole between the two apps.
Constants Completeness
Are all string literals that appear in both apps/api and apps/web consolidated here?
Are enum-like constants exported as as const objects or TypeScript enums (prefer as const objects for tree-shaking)?
Are there magic strings in either app that should be constants here?
Breaking Change Risk
Are there any schema changes (field renames, type changes, removals) that would silently break the consuming app? For example, renaming a field in a response schema without updating the web's usage.
Are backward-incompatible changes guarded with .optional() to allow gradual migration?
Package Hygiene
Are there any imports inside packages/shared from either app (apps/api or apps/web)? This is a critical circular-dependency bug.
Are there any unused exports (schemas, types, or constants) that have been abandoned but not removed?
Does package.json list all dependencies the package actually imports? Are there undeclared peer dependencies being resolved accidentally from the workspace root?
Are the exports field in package.json and the sub-path import aliases aligned (every sub-path consumers use must be declared in exports)?
Code Quality
Are Zod schemas organized clearly — e.g., base schema → create schema → update schema → response schema — or are they tangled?
Are there redundant .transform() calls that belong in the consuming app's presentation layer, not in the shared schema?
Are validation error messages meaningful (z.string().min(1, 'Name is required')) or absent?
Deliverable
For each issue found, provide:

File path and line number (e.g., src/schemas/transactions.ts:34)
Severity — Critical / High / Medium / Low
Category — Schema Correctness / Type Accuracy / Constants / Breaking Change Risk / Package Hygiene / Code Quality
Description — what is wrong, which app(s) it affects, and why it matters
Fix — the corrected code or the specific change needed
Highlight any issue that could cause a silent runtime bug (wrong type on the wire, missing field, enum mismatch) as Critical. At the end, provide a summary table with total counts per severity.