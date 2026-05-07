# Test Anticipated Budget Seed

This document explains the test fixture data for the anticipated-budget feature: what entries exist, which service branches each one exercises, and how to use the seeder in tests.

---

## Files

| File | Purpose |
|---|---|
| `apps/api/src/db/seeds/test-anticipated-budget.ts` | Data definitions — entry shapes and month overrides |
| `apps/api/src/testing/seed-test-anticipated-budget.ts` | Seeder — inserts the data into the DB for a given user |

---

## Entries

Five entries cover every branch the service can reach.

### 1. Rent — flat entry

```
isIncome: false  |  needWant: Need  |  category: null
monthlyAmount: 1500.00  |  overrides: none
```

All 12 months resolve to `1500`, `isOverride: false`. Exercises:
- The no-override path in `resolveMonths`
- The `null` category path in `resolveCategoryColumns` (no LEFT JOIN hit)

---

### 2. Groceries Budget — mixed-override entry

```
isIncome: false  |  needWant: Need  |  category: Groceries
monthlyAmount: 400.00  |  overrides: June → 500.00
```

Months 1–5 and 7–12 resolve to `400`, `isOverride: false`. Month 6 resolves to `500`, `isOverride: true`. Exercises:
- The `isOverride: true` branch in `resolveMonths`
- Category resolution via the LEFT JOIN in `listEntries`

---

### 3. Car Insurance — irregular entry

```
isIncome: false  |  needWant: Need  |  category: null
monthlyAmount: null  |  overrides: March → 900.00, September → 900.00
```

Months without an override resolve to `0`, `isOverride: false` (the `monthlyAmount: null` default). Months 3 and 9 resolve to `900`, `isOverride: true`. Exercises:
- The `monthlyAmount: null` → default-zero path in `resolveMonths`
- Multiple override rows for the same entry

---

### 4. Paycheque — income entry

```
isIncome: true  |  needWant: null  |  category: Income
monthlyAmount: 4000.00  |  overrides: none
```

`needWant` is `null` because the DB check constraint (`income_need_want_check`) requires it when `isIncome` is true. Exercises:
- The income classification path
- Enforcing the `needWant: null` constraint at the data layer

---

### 5. Dining Out — Want entry

```
isIncome: false  |  needWant: Want  |  category: Dining
monthlyAmount: 200.00  |  overrides: none
```

Flat entry with `Want` classification. Exercises:
- The `Want` needWant path (distinct from the `Need` and `null` paths above)
- Category resolution for a second non-null category

---

## Month Overrides

| Entry | Month | Amount |
|---|---|---|
| Groceries Budget | 6 (June) | 500.00 |
| Car Insurance | 3 (March) | 900.00 |
| Car Insurance | 9 (September) | 900.00 |

---

## Using the Seeder

### Prerequisite

`resetTestSystemData()` must have run before `seedTestAnticipatedBudget` is called. The seeder resolves category names (`Groceries`, `Income`, `Dining`) to UUIDs from the system category rows that `resetTestSystemData` inserts.

`setup.ts` calls `resetTestSystemData()` in a global `beforeAll`, so this prerequisite is satisfied automatically in any test file that uses the standard Vitest setup.

---

### Typical usage — seed once per file

```ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, registerUser } from '@/testing/test-helpers';
import { seedTestAnticipatedBudget } from '@/testing/seed-test-anticipated-budget';

let accessToken: string;
let userId: string;
let entryIds: Map<string, string>;

beforeAll(async () => {
  await cleanDatabase();
  ({ accessToken, id: userId } = await registerUser(app));
  entryIds = await seedTestAnticipatedBudget(userId);
});

it('resolves Car Insurance months without overrides to zero', async () => {
  const carInsuranceId = entryIds.get('Car Insurance');
  // ... use carInsuranceId in the request
});
```

---

### Typical usage — seed per test

When individual tests mutate entries (e.g. testing PATCH or DELETE), seed fresh data in `beforeEach` instead:

```ts
beforeEach(async () => {
  await cleanDatabase();
  ({ accessToken, id: userId } = await registerUser(app));
  entryIds = await seedTestAnticipatedBudget(userId);
});
```

`cleanDatabase()` deletes `anticipated_budget_months` before `anticipated_budget` (FK order), so no manual teardown is needed.

---

### Using `clearTestAnticipatedBudget`

If a test file seeds data in `beforeAll` but some tests need to start clean without re-registering the user, use `clearTestAnticipatedBudget` to wipe only the anticipated-budget rows:

```ts
import { clearTestAnticipatedBudget } from '@/testing/seed-test-anticipated-budget';

beforeEach(async () => {
  await clearTestAnticipatedBudget(userId);
  entryIds = await seedTestAnticipatedBudget(userId);
});
```

---

## Branch Coverage Summary

| Branch | Covered by |
|---|---|
| All months at default amount (`isOverride: false`) | Rent, Paycheque, Dining Out |
| At least one month override (`isOverride: true`) | Groceries Budget, Car Insurance |
| `monthlyAmount: null` → zero default | Car Insurance |
| Multiple overrides on one entry | Car Insurance (March + September) |
| `isIncome: true`, `needWant: null` | Paycheque |
| `needWant: Need` | Rent, Groceries Budget, Car Insurance |
| `needWant: Want` | Dining Out |
| `categoryId: null` (no LEFT JOIN hit) | Rent, Car Insurance |
| `categoryId` set (LEFT JOIN hit) | Groceries Budget, Paycheque, Dining Out |
