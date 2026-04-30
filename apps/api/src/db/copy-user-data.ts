import { eq, isNull } from 'drizzle-orm';
import { categories, categorizationRules } from './schema';
import type { db, DbTransaction } from './index';

/**
 * Copy the system category tree (userId = null) to a specific user.
 * Call this within the registration transaction so a failed seed rolls back
 * the user insert as well.
 */
export async function seedUserCategories(
  userId: string,
  tx: typeof db | DbTransaction
): Promise<void> {
  // Fetch all system categories in one query — avoid N+1
  const systemCategories = await tx
    .select({
      id: categories.id,
      name: categories.name,
      isIncome: categories.isIncome,
      icon: categories.icon,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(isNull(categories.userId));

  const topLevel = systemCategories.filter((c) => c.parentId === null);
  const subs = systemCategories.filter(
    (c): c is typeof c & { parentId: string } => c.parentId !== null
  );

  // Map old system ID → new user-owned ID
  const idMap = new Map<string, string>();

  if (topLevel.length > 0) {
    const inserted = await tx
      .insert(categories)
      .values(
        topLevel.map((c) => ({
          userId,
          name: c.name,
          isIncome: c.isIncome,
          icon: c.icon,
          parentId: null,
        }))
      )
      .returning({ id: categories.id, name: categories.name });

    // Match by name to build the id map (names are unique among top-level system cats)
    for (const row of inserted) {
      const original = topLevel.find((c) => c.name === row.name);
      if (original) idMap.set(original.id, row.id);
    }
  }

  if (subs.length > 0) {
    await tx.insert(categories).values(
      subs.map((c) => ({
        userId,
        name: c.name,
        isIncome: c.isIncome,
        icon: c.icon,
        // remap to the user's copy of the parent
        parentId: idMap.get(c.parentId) ?? c.parentId,
      }))
    );
  }
}

/**
 * Copy the system rule set (userId = null) to a specific user, remapping
 * categoryId and subcategoryId to the user's own category copies.
 * Call this after seedUserCategories so the user's category tree exists.
 */
export async function seedUserRules(
  userId: string,
  tx: typeof db | DbTransaction
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

  // Build system category ID → user category ID map
  const sysCats = await tx
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
    .from(categories)
    .where(isNull(categories.userId));

  const userCats = await tx
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.userId, userId));

  const sysTop = sysCats.filter((c) => c.parentId === null);
  const sysSubs = sysCats.filter((c): c is typeof c & { parentId: string } => c.parentId !== null);
  const userTop = userCats.filter((c) => c.parentId === null);
  const userSubs = userCats.filter((c): c is typeof c & { parentId: string } => c.parentId !== null);

  const idMap = new Map<string, string>();

  for (const sys of sysTop) {
    const match = userTop.find((u) => u.name === sys.name);
    if (match) idMap.set(sys.id, match.id);
  }

  for (const sys of sysSubs) {
    const userParentId = idMap.get(sys.parentId);
    if (!userParentId) continue;
    const match = userSubs.find((u) => u.name === sys.name && u.parentId === userParentId);
    if (match) idMap.set(sys.id, match.id);
  }

  await tx.insert(categorizationRules).values(
    systemRules.map((rule) => ({
      userId,
      keyword: rule.keyword,
      sourceName: rule.sourceName,
      categoryId: rule.categoryId ? (idMap.get(rule.categoryId) ?? null) : null,
      subcategoryId: rule.subcategoryId ? (idMap.get(rule.subcategoryId) ?? null) : null,
      needWant: rule.needWant,
      priority: rule.priority,
    }))
  );
}
