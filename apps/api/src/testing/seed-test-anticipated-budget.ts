import { eq, inArray, isNull } from 'drizzle-orm';
import { assertDefined } from '@/lib/assert';
import { db } from '@/db';
import { anticipatedBudget, anticipatedBudgetMonths, categories } from '@/db/schema';
import {
  TEST_ANTICIPATED_BUDGET,
  TEST_ANTICIPATED_BUDGET_MONTHS,
} from '@/db/seeds/test-anticipated-budget';

/**
 * Insert the test anticipated-budget entries and their month overrides for the
 * given user.
 *
 * Prerequisite: resetTestSystemData() must have run so that the system category
 * rows (userId IS NULL) are present — this function resolves category names to
 * IDs from those rows.
 *
 * Returns a Map of entry name → inserted UUID so callers can reference specific
 * entries in assertions without hard-coding IDs.
 */
export async function seedTestAnticipatedBudget(
  userId: string
): Promise<Map<string, string>> {
  // Resolve category names used in TEST_ANTICIPATED_BUDGET to their DB IDs.
  // Only system (userId IS NULL) parent rows are queried — subcategories are
  // not referenced by anticipated budget entries.
  const categoryNames = TEST_ANTICIPATED_BUDGET.flatMap((e) =>
    e.category ? [e.category] : []
  );

  const categoryRows =
    categoryNames.length > 0
      ? await db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(isNull(categories.userId))
      : [];

  const categoryIdByName = new Map(categoryRows.map((r) => [r.name, r.id]));

  // Insert entries and build a name → id map for the month-override pass.
  const entryIdByName = new Map<string, string>();

  for (const entry of TEST_ANTICIPATED_BUDGET) {
    const categoryId = entry.category
      ? (categoryIdByName.get(entry.category) ?? null)
      : null;

    const [row] = await db
      .insert(anticipatedBudget)
      .values({
        userId,
        categoryId,
        name: entry.name,
        needWant: entry.needWant,
        isIncome: entry.isIncome,
        monthlyAmount: entry.monthlyAmount,
        notes: entry.notes,
        effectiveYear: entry.effectiveYear,
      })
      .returning({ id: anticipatedBudget.id });

    assertDefined(row, `Expected insert for '${entry.name}' to return a row`);
    entryIdByName.set(entry.name, row.id);
  }

  // Insert month overrides, resolving entry names to the IDs inserted above.
  for (const override of TEST_ANTICIPATED_BUDGET_MONTHS) {
    const entryId = entryIdByName.get(override.entryName);
    assertDefined(
      entryId,
      `No entry found for override entryName '${override.entryName}'`
    );

    await db.insert(anticipatedBudgetMonths).values({
      anticipatedBudgetId: entryId,
      month: override.month,
      amount: override.amount,
    });
  }

  return entryIdByName;
}

/**
 * Remove all anticipated-budget entries (and their month overrides, via
 * cascade) for the given user.  Useful in beforeEach hooks when a test file
 * seeds data in beforeAll and needs a clean slate between individual tests.
 */
export async function clearTestAnticipatedBudget(userId: string): Promise<void> {
  const rows = await db
    .select({ id: anticipatedBudget.id })
    .from(anticipatedBudget)
    .where(eq(anticipatedBudget.userId, userId));

  if (rows.length === 0) return;

  const ids = rows.map((r) => r.id);
  await db
    .delete(anticipatedBudgetMonths)
    .where(inArray(anticipatedBudgetMonths.anticipatedBudgetId, ids));
  await db
    .delete(anticipatedBudget)
    .where(inArray(anticipatedBudget.id, ids));
}
