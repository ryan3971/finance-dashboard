# API Testing

Read before writing or changing a test in `apps/api`.

The suite is integration-only — no separate unit test files. Test files sit beside the code they
cover (`features/investments/investments.routes.test.ts`); `src/testing/` holds the shared setup,
helpers, fixtures, seeders, and sample CSVs they import.

Tests run in parallel (`fileParallelism: true`) against a real `finance_test` database, and
`testing/setup.ts` switches the connection to `DATABASE_URL_TEST` automatically. Isolation comes
from scoping every row to a per-worker user: `registerUser()` injects a unique email suffix so
workers never collide on the unique constraint, and `cleanDatabase()` deletes only rows owned by
users registered in the current file, leaving system rows (`userId IS NULL`) intact. See
`src/testing/test-helpers.ts`.

## What to assert

Assert the external contract — status codes, response body fields, side effects. The bar: an
internal refactor leaves the suite green, and a change in observable behaviour turns it red. Asserting
on internals is what breaks that property.

Hardcode expected values — status codes, field values, error messages — rather than deriving them
from the code under test, which would let a bug satisfy its own assertion. Reach for `toMatchObject`
when only a subset of fields defines the contract, so additive changes stay green while the fields
that matter still catch regressions.

## Schema and type validation

Define expected shapes inline in the test, as a local interface. Importing the shared Zod schema or
type means both sides change together and the regression passes silently; the inline copy is what
makes the test an independent check, and it documents the endpoint contract at the same time.

Casting a response body to a local interface is the supported way to clear unsafe-member-access lint
errors:

```ts
interface ResponseBody {
  year: number;
  title: string;
}
const body = response.body as ResponseBody;
expect(body.year).toBe(2024);
```

The cast satisfies the type checker; the assertions after it are the actual safety net. Inputs to the
function or service under test stay properly typed, so TypeScript still catches mismatches between
test data and signatures. Lint errors get fixed rather than suppressed — `eslint-disable` and
`as any` are not the tool here.

## Reference tests

When a new test file needs a model for format and setup, copy the patterns in
`features/auth/auth.routes.test.ts` (cookie handling, `trackForCleanup`, nested `describe` for
preconditions) and `features/transactions/transactions.routes.test.ts`.
