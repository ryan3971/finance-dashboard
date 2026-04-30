import { eq, inArray, isNull } from 'drizzle-orm';
import { assertDefined } from '@/lib/assert';
import { db } from '@/db';
import {
  anticipatedBudget,
  anticipatedBudgetMonths,
  categories,
} from '@/db/schema';
import {
  STAGING_ANTICIPATED_BUDGET,
  STAGING_ANTICIPATED_BUDGET_MONTHS,
} from '../seeds/staging/anticipated-budget';

export async function seedStagingAnticipatedBudget(
  userId: string
): Promise<Map<string, string>> {
  const categoryNames = STAGING_ANTICIPATED_BUDGET.flatMap((e) =>
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

  const entryIdByName = new Map<string, string>();

  for (const entry of STAGING_ANTICIPATED_BUDGET) {
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

  for (const override of STAGING_ANTICIPATED_BUDGET_MONTHS) {
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

export async function clearStagingAnticipatedBudget(
  userId: string
): Promise<void> {
  const rows = await db
    .select({ id: anticipatedBudget.id })
    .from(anticipatedBudget)
    .where(eq(anticipatedBudget.userId, userId));

  if (rows.length === 0) return;

  const ids = rows.map((r) => r.id);
  await db
    .delete(anticipatedBudgetMonths)
    .where(inArray(anticipatedBudgetMonths.anticipatedBudgetId, ids));
  await db.delete(anticipatedBudget).where(inArray(anticipatedBudget.id, ids));
}
