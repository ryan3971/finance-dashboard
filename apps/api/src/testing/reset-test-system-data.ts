import { isNull } from 'drizzle-orm';
import { categories, categorizationRules } from '@/db/schema';
import { assertDefined } from '@/lib/assert';
import { db } from '@/db';
import { TEST_CATEGORIES } from '@/testing/seeds/test-categories';
import { TEST_RULES } from '@/testing/seeds/test-rules';

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
 *   1. Delete rules before categories — rules hold FKs into categories.
 *   2. Insert categories before rules — rules need the IDs that seeding produces.
 */
export async function resetTestSystemData(): Promise<void> {
  await db
    .delete(categorizationRules)
    .where(isNull(categorizationRules.userId));
  await db.delete(categories).where(isNull(categories.userId));

  // Map "ParentName" and "ParentName/SubName" → newly inserted UUID.
  // Used below to resolve category/subcategory names in rule records.
  const idByPath = new Map<string, string>();

  for (const cat of TEST_CATEGORIES) {
    const [parent] = await db
      .insert(categories)
      .values({
        userId: null,
        name: cat.name,
        isIncome: cat.isIncome,
        icon: cat.icon,
        parentId: null,
      })
      .returning({ id: categories.id });
    assertDefined(parent, 'Expected category insert to return a row');
    idByPath.set(cat.name, parent.id);

    for (const subName of cat.subcategories) {
      const [sub] = await db
        .insert(categories)
        .values({
          userId: null,
          name: subName,
          isIncome: cat.isIncome,
          icon: null,
          parentId: parent.id,
        })
        .returning({ id: categories.id });
      assertDefined(sub, 'Expected subcategory insert to return a row');
      idByPath.set(`${cat.name}/${subName}`, sub.id);
    }
  }

  for (const rule of TEST_RULES) {
    const categoryId = rule.category
      ? (idByPath.get(rule.category) ?? null)
      : null;
    const subcategoryId =
      rule.category && rule.subcategory
        ? (idByPath.get(`${rule.category}/${rule.subcategory}`) ?? null)
        : null;

    await db.insert(categorizationRules).values({
      userId: null,
      keyword: rule.keyword,
      sourceName: rule.sourceName,
      categoryId,
      subcategoryId,
      needWant: rule.needWant,
      priority: rule.priority,
    });
  }
}
