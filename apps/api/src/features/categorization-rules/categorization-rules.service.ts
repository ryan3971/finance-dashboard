import { alias } from 'drizzle-orm/pg-core';
import { categorizationRules, categories } from '@/db/schema';
import { db, type DbTransaction } from '@/db';
import { desc, eq } from 'drizzle-orm';
import type { PatchRuleInput } from '@finance/shared/schemas/rules';
import { RuleError, RuleErrorCode } from './categorization-rules.errors';

const cat = alias(categories, 'cat');
const subcat = alias(categories, 'subcat');

function ruleSelect(conn: typeof db | DbTransaction = db) {
  return conn
    .select({
      id: categorizationRules.id,
      keyword: categorizationRules.keyword,
      sourceName: categorizationRules.sourceName,
      categoryId: categorizationRules.categoryId,
      categoryName: cat.name,
      subcategoryId: categorizationRules.subcategoryId,
      subcategoryName: subcat.name,
      needWant: categorizationRules.needWant,
      priority: categorizationRules.priority,
      createdAt: categorizationRules.createdAt,
    })
    .from(categorizationRules)
    .leftJoin(cat, eq(categorizationRules.categoryId, cat.id))
    .leftJoin(subcat, eq(categorizationRules.subcategoryId, subcat.id));
}

// Fix 1: extracted ownership check — eliminates duplication across mutations
async function fetchOwnedRule(
  id: string,
  userId: string,
  conn: typeof db | DbTransaction = db
) {
  const [row] = await conn
    .select({ id: categorizationRules.id, userId: categorizationRules.userId })
    .from(categorizationRules)
    .where(eq(categorizationRules.id, id))
    .limit(1);
  if (!row) throw new RuleError(RuleErrorCode.NOT_FOUND);
  if (row.userId !== userId) throw new RuleError(RuleErrorCode.FORBIDDEN);
  return row;
}

export async function listRules(userId: string) {
  return ruleSelect()
    .where(eq(categorizationRules.userId, userId))
    .orderBy(desc(categorizationRules.priority), categorizationRules.createdAt);
}

// Fix 2: ownership check + update + re-select are now atomic within a transaction
// Fix 3: accepts optional tx so it can participate in a larger transaction
// Fix 4: race between ownership check and write resolved — both happen in the same transaction
export async function updateRule(
  id: string,
  userId: string,
  input: PatchRuleInput,
  tx?: typeof db | DbTransaction
) {
  const execute = async (conn: typeof db | DbTransaction) => {
    await fetchOwnedRule(id, userId, conn);

    await conn
      .update(categorizationRules)
      .set(input)
      .where(eq(categorizationRules.id, id));

    const [updated] = await ruleSelect(conn)
      .where(eq(categorizationRules.id, id))
      .limit(1);
    if (!updated) throw new RuleError(RuleErrorCode.NOT_FOUND);
    return updated;
  };

  return tx ? execute(tx) : db.transaction(execute);
}

// Fix 2: ownership check + delete are now atomic within a transaction
// Fix 3: accepts optional tx so it can participate in a larger transaction
// Fix 4: race between ownership check and write resolved — both happen in the same transaction
export async function deleteRule(
  id: string,
  userId: string,
  tx?: typeof db | DbTransaction
) {
  const execute = async (conn: typeof db | DbTransaction) => {
    await fetchOwnedRule(id, userId, conn);
    await conn
      .delete(categorizationRules)
      .where(eq(categorizationRules.id, id));
  };

  return tx ? execute(tx) : db.transaction(execute);
}
