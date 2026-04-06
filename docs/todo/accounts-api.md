# Accounts API — Deferred Issues

## Design

### Deactivate / Reactivate endpoints are RPC-style, not RESTful
**Files:** `apps/api/src/features/accounts/accounts-mutation.routes.ts`

The current endpoints for toggling account status are action-based:

```
POST /api/v1/accounts/:id/deactivate
POST /api/v1/accounts/:id/reactivate
```

This is an accepted pattern for state transitions, but it diverges from the REST convention already used by the PATCH route. A more RESTful alternative would be to expose `isActive` as a patchable field:

```
PATCH /api/v1/accounts/:id  { isActive: false }  → deactivate
PATCH /api/v1/accounts/:id  { isActive: true }   → reactivate
```

This would require:
1. Adding `isActive` to `UpdateAccountInput` in `accounts.services.ts`
2. Exposing `isActive` on the patch schema (currently derived from `accountFormSchema` which omits it)
3. Removing the dedicated `deactivateAccount` / `reactivateAccount` service exports (or keeping them as internal helpers called by `updateAccount`)
4. Updating the frontend mutation hooks and API client calls

**Trade-off:** The current action endpoints make intent explicit and keep deactivation as a named operation — which is useful if deactivation ever needs side effects (e.g., hiding transactions, cascading to linked data). Collapsing it into PATCH would obscure that semantic distinction. Only worth changing if the API surface needs to be more uniform.
