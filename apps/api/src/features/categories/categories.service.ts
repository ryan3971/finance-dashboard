import { eq, isNull, or } from 'drizzle-orm';
import { categories, transactions } from '@/db/schema';
import { db, type DbTransaction } from '@/db';
import type { CreateSubcategoryInput } from '@finance/shared';
import { CategoryError, CategoryErrorCode } from './categories.errors';

async function fetchOwnedSubcategory(
  id: string,
  userId: string,
  conn: typeof db | DbTransaction = db
) {
  const [row] = await conn
    .select({ id: categories.id, userId: categories.userId })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!row) throw new CategoryError(CategoryErrorCode.NOT_FOUND);
  if (row.userId === null || row.userId !== userId)
    throw new CategoryError(CategoryErrorCode.FORBIDDEN);
  return row;
}

export async function getCategoryTree(userId: string) {
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      isIncome: categories.isIncome,
      icon: categories.icon,
      userId: categories.userId,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(or(isNull(categories.userId), eq(categories.userId, userId)))
    .orderBy(categories.name);

  const subcategoryMap = new Map<string, typeof allCategories>();
  const topLevel: typeof allCategories = [];

  for (const category of allCategories) {
    if (category.parentId === null) {
      topLevel.push(category);
    } else {
      const siblings = subcategoryMap.get(category.parentId) ?? [];
      siblings.push(category);
      subcategoryMap.set(category.parentId, siblings);
    }
  }

  return topLevel.map((parent) => ({
    id: parent.id,
    name: parent.name,
    isIncome: parent.isIncome,
    icon: parent.icon,
    userId: parent.userId,
    subcategories: (subcategoryMap.get(parent.id) ?? []).map((sub) => ({
      id: sub.id,
      name: sub.name,
      isIncome: sub.isIncome,
      icon: sub.icon,
      userId: sub.userId,
    })),
  }));
}

export async function createSubcategory(
  userId: string,
  input: CreateSubcategoryInput,
  tx?: typeof db | DbTransaction
) {
  const conn = tx ?? db;

  const [parent] = await conn
    .select({
      id: categories.id,
      isIncome: categories.isIncome,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(eq(categories.id, input.parentId))
    .limit(1);

  if (!parent || parent.parentId !== null) {
    throw new CategoryError(CategoryErrorCode.INVALID_PARENT);
  }

  const [created] = await conn
    .insert(categories)
    .values({
      name: input.name,
      parentId: input.parentId,
      userId,
      isIncome: parent.isIncome,
    })
    .returning({
      id: categories.id,
      name: categories.name,
      isIncome: categories.isIncome,
      icon: categories.icon,
      userId: categories.userId,
    });

  if (!created) throw new Error('Insert returned no rows');
  return created;
}

export async function renameSubcategory(
  id: string,
  userId: string,
  name: string,
  tx?: typeof db | DbTransaction
) {
  const execute = async (conn: typeof db | DbTransaction) => {
    await fetchOwnedSubcategory(id, userId, conn);

    const [updated] = await conn
      .update(categories)
      .set({ name })
      .where(eq(categories.id, id))
      .returning({
        id: categories.id,
        name: categories.name,
        isIncome: categories.isIncome,
        icon: categories.icon,
        userId: categories.userId,
      });

    if (!updated) throw new CategoryError(CategoryErrorCode.NOT_FOUND);
    return updated;
  };

  return tx ? execute(tx) : db.transaction(execute);
}

export async function deleteSubcategory(
  id: string,
  userId: string,
  tx?: typeof db | DbTransaction
) {
  const execute = async (conn: typeof db | DbTransaction) => {
    await fetchOwnedSubcategory(id, userId, conn);

    await conn
      .update(transactions)
      .set({ subcategoryId: null })
      .where(eq(transactions.subcategoryId, id));

    await conn.delete(categories).where(eq(categories.id, id));
  };

  return tx ? execute(tx) : db.transaction(execute);
}
