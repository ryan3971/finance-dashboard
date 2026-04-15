Review the unit test(s) in [FILE_PATH] and provide a structured critique across four areas:

**1. Test Coverage & Edge Cases**
- Does each test target a single unit of behavior (one function, one method, one branch)?
- Are all logical branches covered: truthy/falsy conditions, early returns, thrown errors?
- Are boundary values tested (empty strings, zero, negative numbers, null, undefined)?
- Are there any code paths in the implementation that no test would catch breaking?

**2. Reliability & Flakiness Risks**
- Are all dependencies (modules, services, DB calls) properly mocked or stubbed? Flag any real I/O that should be faked.
- Are mocks reset between tests? Call out missing jest.clearAllMocks(), sinon.restore(), or equivalent.
- Are there any implicit dependencies on global state, environment variables, or module-level side effects?
- Are all async functions fully awaited with no floating promises?

**3. Code Quality & Structure**
- Is each test named to describe the specific behavior being verified (e.g. "returns null when input is empty"), not just the function name?
- Is the Arrange / Act / Assert structure clear and consistent?
- Is there duplicated setup that should live in beforeEach or a shared factory/helper?
- Are assertions tight enough to catch real regressions, or are they too shallow (e.g. toBeTruthy() where toEqual(...) is warranted)?
- Does each test have exactly one logical assertion, or are multiple unrelated things being verified in one test?

**4. Performance**
- Are any mocks or spies doing unnecessary work (e.g. real async behavior when a sync stub would do)?
- Is test setup proportionate to what's being tested, or is there heavy bootstrapping for trivial assertions?
- Are there opportunities to use test.each / parameterized tests to replace repetitive near-identical test blocks?

For each issue found, provide: the line or block it applies to, a brief explanation of the problem, and a concrete suggestion to fix it. Prioritize by severity (critical / moderate / minor).

Review the CLAUDE.md file for any relevant context on the project or testing approach.