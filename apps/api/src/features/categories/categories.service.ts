import { count, eq } from 'drizzle-orm';
import { categories, transactions } from '@/db/schema';
import { db, type DbTransaction } from '@/db';
import type { CreateCategoryInput } from '@finance/shared/schemas/categories';
import { CategoryError, CategoryErrorCode } from './categories.errors';

async function fetchOwnedCategory(
  id: string,
  userId: string,
  conn: typeof db | DbTransaction = db
) {
  const [row] = await conn
    .select({
      id: categories.id,
      userId: categories.userId,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!row) throw new CategoryError(CategoryErrorCode.NOT_FOUND);
  if (row.userId !== userId)
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
    .where(eq(categories.userId, userId))
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

export async function createCategory(
  userId: string,
  input: CreateCategoryInput,
  tx?: typeof db | DbTransaction
) {
  const conn = tx ?? db;

  if (input.parentId) {
    // Creating a subcategory — parent must be a user-owned top-level category
    const [parent] = await conn
      .select({
        id: categories.id,
        isIncome: categories.isIncome,
        parentId: categories.parentId,
        userId: categories.userId,
      })
      .from(categories)
      .where(eq(categories.id, input.parentId))
      .limit(1);

    if (!parent || parent.parentId !== null || parent.userId !== userId) {
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

  // Creating a top-level category — isIncome is required
  if (input.isIncome === undefined) {
    throw new CategoryError(CategoryErrorCode.INVALID_PARENT);
  }

  const [created] = await conn
    .insert(categories)
    .values({
      name: input.name,
      parentId: null,
      userId,
      isIncome: input.isIncome,
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

export async function renameCategory(
  id: string,
  userId: string,
  name: string,
  tx?: typeof db | DbTransaction
) {
  const execute = async (conn: typeof db | DbTransaction) => {
    await fetchOwnedCategory(id, userId, conn);

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

export async function deleteCategory(
  id: string,
  userId: string,
  tx?: typeof db | DbTransaction
) {
  const execute = async (conn: typeof db | DbTransaction) => {
    const category = await fetchOwnedCategory(id, userId, conn);

    if (category.parentId !== null) {
      // Subcategory: fall back transactions to the parent category
      await conn
        .update(transactions)
        .set({ subcategoryId: null, categoryId: category.parentId })
        .where(eq(transactions.subcategoryId, id));
    } else {
      // Top-level: block if subcategories still exist
      const [{ subcategoryCount }] = await conn
        .select({ subcategoryCount: count() })
        .from(categories)
        .where(eq(categories.parentId, id));

      if (subcategoryCount > 0) {
        throw new CategoryError(CategoryErrorCode.HAS_SUBCATEGORIES);
      }

      // Fall back transactions to uncategorized state
      await conn
        .update(transactions)
        .set({ categoryId: null, subcategoryId: null })
        .where(eq(transactions.categoryId, id));
    }

    await conn.delete(categories).where(eq(categories.id, id));
  };

  return tx ? execute(tx) : db.transaction(execute);
}
