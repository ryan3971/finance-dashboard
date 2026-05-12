Review the integration test(s) in [FILE_PATH] and provide a structured critique across four areas:

**1. Test Coverage & Edge Cases**
- Are all critical paths through the endpoint/handler covered (happy path, error paths, auth failures, malformed input)?
- What edge cases are missing or under-tested?
- Are boundary conditions handled (empty arrays, null values, max payload sizes)?

**2. Reliability & Flakiness Risks**
- Are there any time-dependent assertions (e.g. hardcoded timeouts, Date.now() comparisons) that could cause intermittent failures?
- Do tests share state or depend on execution order? Flag any missing beforeEach/afterEach cleanup.
- Are external dependencies (DB, third-party APIs) properly mocked or isolated? Call out anywhere real I/O could leak through.
- Are async operations fully awaited with no floating promises?

**3. Code Quality & Structure**
- Are tests clearly named so failures are self-documenting (given/when/then or similar)?
- Is there duplicated setup logic that should be extracted into helpers or fixtures?
- Are assertions specific enough to catch real regressions, or are they too loose (e.g. checking status code only, not response shape)?
- Does the test file follow the project's existing conventions?

**4. Performance**
- Are there any unnecessary sequential awaits that could run in parallel with Promise.all?
- Is the test suite doing excessive DB seeding or teardown that could be scoped more tightly?
- Any obvious bottlenecks that will slow the test run as the suite grows?

For each issue found, provide: the line or block it applies to, a brief explanation of the problem, and a concrete suggestion to fix it. Prioritize issues by severity (critical / moderate / minor).

Review the CLAUDE.md file for any relevant context on the project or testing approach.

@apps/api/src/features/auth/auth.routes.test.ts  and @apps/api/src/features/transactions/transactions.routes.test.ts  can be used as references to understand the tests format and setup 