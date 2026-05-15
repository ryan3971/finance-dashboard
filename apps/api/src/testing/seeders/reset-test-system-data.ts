import { isNull } from 'drizzle-orm';
import {
  anticipatedBudget,
  anticipatedBudgetMonths,
  categories,
  categorizationRules,
  transactions,
} from '@/db/schema';
import { db } from '@/db';
import { seedTestSystemData } from './seed-test-system-data';

/**
 * Replace system-level categories and rules with the test set.
 *
 * Called from the global beforeAll in setup.ts. System rows (userId IS NULL)
 * survive cleanDatabase() between individual tests, so the test set is stable
 * for the entire test file without any per-test re-seeding.
 *
 * Performing a full replace (delete → re-seed) on every call is intentional:
 * it guards against the test DB containing a stale production set from a
 * previous manual seed run, and keeps per-file startup cost predictable.
 *
 * Ordering matters:
 *   1. Delete transactions before categories — transactions.categoryId/subcategoryId
 *      FK into categories. Stale rows from the last test of the previous file cause
 *      FK violations if not cleared here. transactionTags cascades automatically.
 *   2. Delete rules before categories — rules hold FKs into categories.
 *   3. Insert categories before rules — rules need the IDs that seeding produces.
 */
export async function resetTestSystemData(): Promise<void> {
  // Transactions left over from the last test of the previous file reference
  // system categories. Clear them before deleting those categories.
  await db.delete(transactions);
  // anticipated_budget rows can reference system category IDs (userId IS NULL).
  // Delete them before the system category delete to avoid FK violations when
  // the test DB has leftover data from a previous run.
  await db.delete(anticipatedBudgetMonths);
  await db.delete(anticipatedBudget);
  await db
    .delete(categorizationRules)
    .where(isNull(categorizationRules.userId));
  await db.delete(categories).where(isNull(categories.userId));

  await seedTestSystemData();
}
