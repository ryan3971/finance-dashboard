import { categories, categorizationRules } from '@/db/schema';
import { assertDefined } from '@/lib/assert';
import { db } from '@/db';
import { TEST_CATEGORIES } from '@/testing/seeds/categories';
import { TEST_RULES } from '@/testing/seeds/rules';

export async function seedTestSystemData(): Promise<void> {
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
      const subRows: { id: string }[] = await db
        .insert(categories)
        .values({
          userId: null,
          name: subName,
          isIncome: cat.isIncome,
          icon: null,
          parentId: parent.id,
        })
        .returning({ id: categories.id });
      const [sub] = subRows;
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
