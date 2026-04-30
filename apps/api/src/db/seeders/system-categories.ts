/* eslint-disable no-console */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { assertDefined } from '@/lib/assert';
import { db as defaultDb } from '@/db';
import { anticipatedBudget, categories } from '@/db/schema';
import { SYSTEM_CATEGORIES } from '@/db/seeds/system/categories';
import { STAGING_CATEGORIES } from '@/db/seeds/staging/categories';
import { TEST_CATEGORIES } from '@/db/seeds/test/categories';

export type SeedEnv = 'system' | 'staging' | 'test';
type DbLike = typeof defaultDb;

function getCategoriesData(env: SeedEnv) {
  if (env === 'system') return SYSTEM_CATEGORIES;
  if (env === 'staging') return STAGING_CATEGORIES;
  return TEST_CATEGORIES;
}

export async function addSystemCategories(
  env: SeedEnv,
  db: DbLike = defaultDb
): Promise<void> {
  const data = getCategoriesData(env);
  let inserted = 0;
  let skipped = 0;

  for (const cat of data) {
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          isNull(categories.userId),
          isNull(categories.parentId),
          eq(categories.name, cat.name)
        )
      )
      .limit(1);

    let parentId: string;

    if (existing) {
      parentId = existing.id;
      skipped++;
    } else {
      const [row] = await db
        .insert(categories)
        .values({
          userId: null,
          name: cat.name,
          isIncome: cat.isIncome,
          icon: cat.icon,
          parentId: null,
        })
        .returning({ id: categories.id });
      assertDefined(row, `Expected insert for category "${cat.name}"`);
      parentId = row.id;
      inserted++;
    }

    for (const subName of cat.subcategories) {
      const [existingSub] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            isNull(categories.userId),
            eq(categories.parentId, parentId),
            eq(categories.name, subName)
          )
        )
        .limit(1);

      if (existingSub) {
        skipped++;
        continue;
      }

      await db.insert(categories).values({
        userId: null,
        name: subName,
        isIncome: cat.isIncome,
        icon: null,
        parentId,
      });
      inserted++;
    }
  }

  console.log(`Categories — inserted: ${inserted}, skipped: ${skipped}`);
}

export async function removeSystemCategories(
  db: DbLike = defaultDb
): Promise<void> {
  const systemCategoryRows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(isNull(categories.userId));

  if (systemCategoryRows.length === 0) {
    console.log('No system categories found — nothing to delete');
    return;
  }

  const systemCategoryIds = systemCategoryRows.map((r) => r.id);

  const { rowCount: budgetNulled } = await db
    .update(anticipatedBudget)
    .set({ categoryId: null })
    .where(inArray(anticipatedBudget.categoryId, systemCategoryIds));

  if (budgetNulled && budgetNulled > 0) {
    console.log(
      `Nulled categoryId on ${budgetNulled} anticipated_budget row(s)`
    );
  }

  const { rowCount: catsDeleted } = await db
    .delete(categories)
    .where(inArray(categories.id, systemCategoryIds));

  console.log(`Deleted ${catsDeleted ?? 0} system category row(s)`);
}
