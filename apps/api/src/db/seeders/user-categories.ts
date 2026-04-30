import { isNull } from 'drizzle-orm';
import { categories } from '@/db/schema';
import type { db as defaultDb, DbTransaction } from '@/db';

/**
 * Copy the system category tree (userId = null) to a specific user.
 * Call this within the registration transaction so a failed seed rolls back
 * the user insert as well.
 */
export async function seedUserCategories(
  userId: string,
  tx: typeof defaultDb | DbTransaction
): Promise<void> {
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
        parentId: idMap.get(c.parentId) ?? c.parentId,
      }))
    );
  }
}
