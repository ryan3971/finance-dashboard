Review the following service layer file and evaluate it across these dimensions:

---

## 1. Separation of Concerns
- Is the service doing more than orchestrating business logic and data access?
- Are HTTP concepts leaking in? (e.g., status codes, request/response objects, headers)
- Is presentation logic leaking in? (e.g., formatting responses, shaping data for a specific client)
- Are Drizzle queries acceptable here — but are they encapsulated cleanly or scattered inline throughout?

## 2. Business Logic Quality
- Is domain logic clearly expressed and easy to follow?
- Are magic numbers or strings used instead of named constants?
- Is conditional logic overly complex — could it be simplified or extracted into a helper?
- Are edge cases handled explicitly (empty results, null values, zero quantities)?

## 3. Data Access (Drizzle)
- Are queries scoped correctly — fetching only the columns and rows needed?
- Are N+1 query patterns present? (e.g., querying inside a loop instead of joining or batching)
- Are transactions used where multiple writes must succeed or fail together?
- Are queries reused across the file — or duplicated with slight variations that should be extracted?
- Are raw SQL fragments used where Drizzle's query builder would be safer?

## 4. Error Handling
- Are database errors caught and translated into meaningful domain errors?
- Are "not found" cases handled explicitly rather than returning undefined silently?
- Is error propagation intentional — does the service throw, return, or swallow errors consistently?
- Are errors typed or structured so the router layer can handle them predictably?

## 5. Validation & Invariants
- Are business rule violations caught at this layer before hitting the database?
- Are preconditions checked before performing destructive operations (update, delete)?
- Is there any duplicate validation already handled by the router that could be removed?

## 6. Transactions & Consistency
- When multiple tables are written to, is a transaction used?
- Are there race conditions possible due to read-then-write patterns without locking or isolation?
- Is optimistic concurrency or versioning used where relevant?

## 7. Testability
- Can this service be unit tested with a mocked or in-memory Drizzle instance?
- Are side effects (emails, events, external API calls) isolated or injected so they can be swapped in tests?
- Are functions pure where possible — same inputs producing same outputs without hidden state?

## 8. Single Responsibility
- Does each function do one clearly named thing?
- Are functions that do multiple unrelated things candidates for splitting?
- Is there logic that belongs in a different service (e.g., auth concerns in a billing service)?

## 9. Naming & Readability
- Do function names describe what they do at the business level, not the implementation level?
  (e.g., cancelSubscription not updateSubscriptionStatusToInactive)
- Are intermediate variables named to communicate intent, not just mirror the code?
- Is the level of abstraction consistent throughout the file?

## 10. Side Effects & External Calls
- Are calls to external APIs, queues, or email services clearly separated from core logic?
- Is there retry or fallback logic where external calls can fail?
- Are side effects triggered after a successful DB write, not before?

---

For each issue found, note:
- **Severity**: High / Medium / Low
- **Location**: Function or line reference
- **Issue**: What the problem is
- **Suggestion**: How to fix or improve it

Flag anything that looks correct and well-structured as well — good patterns are worth noting.