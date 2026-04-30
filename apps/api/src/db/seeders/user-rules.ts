import { eq, isNull } from 'drizzle-orm';
import { categories, categorizationRules } from '@/db/schema';
import type { db as defaultDb, DbTransaction } from '@/db';

/**
 * Copy the system rule set (userId = null) to a specific user, remapping
 * categoryId and subcategoryId to the user's own category copies.
 * Call this after seedUserCategories so the user's category tree exists.
 */
export async function seedUserRules(
  userId: string,
  tx: typeof defaultDb | DbTransaction
): Promise<void> {
  const systemRules = await tx
    .select({
      keyword: categorizationRules.keyword,
      sourceName: categorizationRules.sourceName,
      categoryId: categorizationRules.categoryId,
      subcategoryId: categorizationRules.subcategoryId,
      needWant: categorizationRules.needWant,
      priority: categorizationRules.priority,
    })
    .from(categorizationRules)
    .where(isNull(categorizationRules.userId));

  if (systemRules.length === 0) return;

  const sysCats = await tx
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(isNull(categories.userId));

  const userCats = await tx
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(eq(categories.userId, userId));

  const sysTop = sysCats.filter((c) => c.parentId === null);
  const sysSubs = sysCats.filter(
    (c): c is typeof c & { parentId: string } => c.parentId !== null
  );
  const userTop = userCats.filter((c) => c.parentId === null);
  const userSubs = userCats.filter(
    (c): c is typeof c & { parentId: string } => c.parentId !== null
  );

  const idMap = new Map<string, string>();

  for (const sys of sysTop) {
    const match = userTop.find((u) => u.name === sys.name);
    if (match) idMap.set(sys.id, match.id);
  }

  for (const sys of sysSubs) {
    const userParentId = idMap.get(sys.parentId);
    if (!userParentId) continue;
    const match = userSubs.find(
      (u) => u.name === sys.name && u.parentId === userParentId
    );
    if (match) idMap.set(sys.id, match.id);
  }

  await tx.insert(categorizationRules).values(
    systemRules.map((rule) => ({
      userId,
      keyword: rule.keyword,
      sourceName: rule.sourceName,
      categoryId: rule.categoryId ? (idMap.get(rule.categoryId) ?? null) : null,
      subcategoryId: rule.subcategoryId
        ? (idMap.get(rule.subcategoryId) ?? null)
        : null,
      needWant: rule.needWant,
      priority: rule.priority,
    }))
  );
}
