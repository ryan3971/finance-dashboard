import { count, eq, inArray, isNull, or } from 'drizzle-orm';
import { assertDefined } from '@/lib/assert';
import { categories, categorizationRules, transactions } from '@/db/schema';
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

/**
 * Repairs transactions that were categorised by a system rule before the
 * loadRules bug was fixed. System rules (userId = null) and user-rule copies
 * (userId = user's id) were both loaded simultaneously; when the system rule
 * fired first it stored a system category UUID that getCategoryTree never
 * returns, causing a blank category display in the review panel.
 *
 * This function remaps every affected transaction's categoryId/subcategoryId
 * from the system UUID to the user's equivalent UUID (matched by name and
 * hierarchy), then returns the number of transactions updated.
 *
 * Safe to call multiple times — subsequent calls will find no affected rows
 * once the data is clean.
 */
export async function repairSystemCategoryLinks(userId: string): Promise<{ updated: number }> {
  const sysCats = await db
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
    .from(categories)
    .where(isNull(categories.userId));

  const userCats = await db
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.userId, userId));

  // Build system UUID → user UUID map (same logic as seedUserRules)
  const idMap = new Map<string, string>();

  const sysTop = sysCats.filter((c) => c.parentId === null);
  const sysSubs = sysCats.filter(
    (c): c is typeof c & { parentId: string } => c.parentId !== null
  );
  const userTop = userCats.filter((c) => c.parentId === null);
  const userSubs = userCats.filter(
    (c): c is typeof c & { parentId: string } => c.parentId !== null
  );

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

  if (idMap.size === 0) return { updated: 0 };

  const systemIds = [...idMap.keys()];

  // Find all transactions for this user whose categoryId or subcategoryId
  // still points at a system UUID.
  const affected = await db
    .select({
      id: transactions.id,
      categoryId: transactions.categoryId,
      subcategoryId: transactions.subcategoryId,
    })
    .from(transactions)
    .where(
      or(
        inArray(transactions.categoryId, systemIds),
        inArray(transactions.subcategoryId, systemIds)
      )
    );

  if (affected.length === 0) return { updated: 0 };

  // Group by resolved (categoryId, subcategoryId) pair to issue one UPDATE
  // per unique outcome rather than one per transaction.
  interface Outcome { categoryId: string | null; subcategoryId: string | null; ids: string[] }
  const byOutcome = new Map<string, Outcome>();

  for (const tx of affected) {
    const newCategoryId = tx.categoryId ? (idMap.get(tx.categoryId) ?? tx.categoryId) : null;
    const newSubcategoryId = tx.subcategoryId
      ? (idMap.get(tx.subcategoryId) ?? tx.subcategoryId)
      : null;
    const key = `${newCategoryId ?? ''}|${newSubcategoryId ?? ''}`;

    const existing = byOutcome.get(key);
    if (existing) {
      existing.ids.push(tx.id);
    } else {
      byOutcome.set(key, { categoryId: newCategoryId, subcategoryId: newSubcategoryId, ids: [tx.id] });
    }
  }

  let updated = 0;
  await db.transaction(async (tx) => {
    for (const { categoryId: newCategoryId, subcategoryId: newSubcategoryId, ids } of byOutcome.values()) {
      await tx
        .update(transactions)
        .set({ categoryId: newCategoryId, subcategoryId: newSubcategoryId })
        .where(inArray(transactions.id, ids));
      updated += ids.length;
    }
  });

  return { updated };
}

export async function deleteCategory(
  id: string,
  userId: string,
  tx?: typeof db | DbTransaction
) {
  const execute = async (conn: typeof db | DbTransaction) => {
    const category = await fetchOwnedCategory(id, userId, conn);

    if (category.parentId !== null) {
      // Subcategory: block if any categorization rules reference it
      const [ruleCount] = await conn
        .select({ ruleCount: count() })
        .from(categorizationRules)
        .where(eq(categorizationRules.subcategoryId, id));
      assertDefined(ruleCount, 'Expected rule count row');
      if (ruleCount.ruleCount > 0) {
        throw new CategoryError(CategoryErrorCode.IN_USE_BY_RULES);
      }

      // Fall back transactions to the parent category
      await conn
        .update(transactions)
        .set({ subcategoryId: null, categoryId: category.parentId })
        .where(eq(transactions.subcategoryId, id));
    } else {
      // Top-level: block if subcategories still exist
      const [countRow] = await conn
        .select({ subcategoryCount: count() })
        .from(categories)
        .where(eq(categories.parentId, id));
      assertDefined(countRow, 'Expected subcategory count row');
      const { subcategoryCount } = countRow;

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
