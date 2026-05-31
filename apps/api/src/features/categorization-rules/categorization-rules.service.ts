import { alias } from 'drizzle-orm/pg-core';
import { accounts, categorizationRules, categories, transactions } from '@/db/schema';
import { db, type DbTransaction } from '@/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { CreateRuleInput, PatchRuleInput } from '@finance/shared/schemas/rules';
import { CATEGORY_SOURCE } from '@finance/shared/constants';
import { CONFIDENCE } from '@/lib/constants';
import { applyRules, type LoadedRule } from '@/pipelines/categorization/rules-engine';
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
      flagForReview: categorizationRules.flagForReview,
      priority: categorizationRules.priority,
      matchType: categorizationRules.matchType,
      createdAt: categorizationRules.createdAt,
    })
    .from(categorizationRules)
    .leftJoin(cat, eq(categorizationRules.categoryId, cat.id))
    .leftJoin(subcat, eq(categorizationRules.subcategoryId, subcat.id));
}

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

export async function getRule(id: string, userId: string) {
  const [rule] = await ruleSelect()
    .where(and(eq(categorizationRules.id, id), eq(categorizationRules.userId, userId)))
    .limit(1);
  if (!rule) throw new RuleError(RuleErrorCode.NOT_FOUND);
  return rule;
}

/**
 * Re-applies an owned rule to all eligible transactions, including those already
 * categorized by a rule. Called after the user edits a rule's categorization fields
 * and explicitly requests the change to propagate to existing matches.
 *
 * Manual categorizations and transfers are never touched.
 * Returns the number of transactions updated.
 */
export async function reapplyRule(id: string, userId: string): Promise<number> {
  const rule = await getRule(id, userId);

  const candidates = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      isIncome: transactions.isIncome,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(accounts.userId, userId),
        eq(transactions.isTransfer, false),
        inArray(transactions.categorySource, [
          CATEGORY_SOURCE.DEFAULT,
          CATEGORY_SOURCE.AI,
          CATEGORY_SOURCE.RULE,
        ])
      )
    );

  if (candidates.length === 0) return 0;

  const loadedRule: LoadedRule = {
    id: rule.id,
    userId,
    keyword: rule.keyword,
    matchType: rule.matchType,
    categoryId: rule.categoryId,
    subcategoryId: rule.subcategoryId,
    needWant: rule.needWant,
    sourceName: rule.sourceName,
    flagForReview: rule.flagForReview,
    priority: rule.priority,
  };

  const sharedValues = {
    categoryId: rule.flagForReview ? null : rule.categoryId,
    subcategoryId: rule.flagForReview ? null : rule.subcategoryId,
    sourceName: rule.sourceName,
    categorySource: CATEGORY_SOURCE.RULE,
    categoryConfidence: String(CONFIDENCE.RULE),
    flaggedForReview: rule.flagForReview,
    updatedAt: new Date(),
  };

  const incomeIds: string[] = [];
  const expenseIds: string[] = [];

  for (const candidate of candidates) {
    if (!applyRules(candidate.description, [loadedRule])) continue;
    if (candidate.isIncome) {
      incomeIds.push(candidate.id);
    } else {
      expenseIds.push(candidate.id);
    }
  }

  const total = incomeIds.length + expenseIds.length;
  if (total === 0) return 0;

  await db.transaction(async (tx) => {
    if (incomeIds.length > 0) {
      await tx
        .update(transactions)
        .set({ ...sharedValues, needWant: null })
        .where(inArray(transactions.id, incomeIds));
    }
    if (expenseIds.length > 0) {
      await tx
        .update(transactions)
        .set({ ...sharedValues, needWant: rule.needWant })
        .where(inArray(transactions.id, expenseIds));
    }
  });

  return total;
}

export async function listRules(userId: string) {
  return ruleSelect()
    .where(eq(categorizationRules.userId, userId))
    .orderBy(desc(categorizationRules.priority), categorizationRules.createdAt);
}

export async function updateRule(
  id: string,
  userId: string,
  input: PatchRuleInput,
  tx?: typeof db | DbTransaction
) {
  const execute = async (conn: typeof db | DbTransaction) => {
    await fetchOwnedRule(id, userId, conn);

    if (Object.keys(input).length > 0) {  // Drizzle will throw if we try to update with an empty object, so we check first
      await conn
        .update(categorizationRules)
        .set(input)
        .where(eq(categorizationRules.id, id));
    }

    const [updated] = await ruleSelect(conn)
      .where(eq(categorizationRules.id, id))
      .limit(1);
    if (!updated) throw new RuleError(RuleErrorCode.NOT_FOUND);
    return updated;
  };

  return tx ? execute(tx) : db.transaction(execute);
}

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

export async function createRule(
  userId: string,
  input: CreateRuleInput,
  tx?: typeof db | DbTransaction
) {
  const execute = async (conn: typeof db | DbTransaction) => {
    const [inserted] = await conn
      .insert(categorizationRules)
      .values({ ...input, userId })
      .returning({ id: categorizationRules.id });
    if (!inserted) throw new Error('insert returned no rows');

    const [rule] = await ruleSelect(conn)
      .where(eq(categorizationRules.id, inserted.id))
      .limit(1);
    if (!rule) throw new RuleError(RuleErrorCode.NOT_FOUND);
    return rule;
  };

  return tx ? execute(tx) : db.transaction(execute);
}
