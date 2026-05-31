import {
  accounts,
  categories,
  categorizationRules,
  rebalancingGroupTransactions,
  tags,
  transactions,
  transactionTags,
} from '@/db/schema';
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { TransactionError, TransactionErrorCode } from './transactions.errors';
import {
  AUTO_RULE_PRIORITY,
  CONFIDENCE,
  KEYWORD_SLICE_LENGTH,
  TRANSACTION_SOURCE,
} from '@/lib/constants';
import { CATEGORY_SOURCE } from '@finance/shared/constants';
import type { NeedWant } from '@finance/shared/constants';
import type { PatchTransactionInput } from '@finance/shared/types/transactions';
import { db, type DbTransaction } from '@/db';
import { assertDefined } from '@/lib/assert';
import { updateGroupAfterMemberRemoval } from '@/pipelines/rebalancing/rebalancing-group-hooks';
import { applyRules, loadRules, type LoadedRule } from '@/pipelines/categorization/rules-engine';
import type { RebalancingRole } from '@finance/shared/types/rebalancing';
// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransactionFilters {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  month?: string; // YYYY-MM; takes precedence over startDate/endDate
  categoryId?: string;
  subcategoryId?: string;
  needWant?: string;
  flagged?: boolean;
  isIncome?: boolean;
  isTransfer?: boolean;
  tagIds?: string[];
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface CreateTransactionInput {
  accountId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  needWant?: NeedWant | null;
  note?: string | null;
  isIncome?: boolean;
}

// Columns returned by the PATCH response. Mirrors the fields the client cares
// about from the transactions table itself (without joined account/category
// names). Internal columns — compositeKey, rawDescription, categoryConfidence,
// importId — are excluded and must never appear in API responses.
const patchTransactionColumns = {
  id: transactions.id,
  date: transactions.date,
  description: transactions.description,
  sourceName: transactions.sourceName,
  amount: transactions.amount,
  currency: transactions.currency,
  categoryId: transactions.categoryId,
  subcategoryId: transactions.subcategoryId,
  needWant: transactions.needWant,
  isTransfer: transactions.isTransfer,
  transferMatchId: transactions.transferMatchId,
  transferPairId: transactions.transferPairId,
  isIncome: transactions.isIncome,
  isInvestmentContribution: transactions.isInvestmentContribution,
  flaggedForReview: transactions.flaggedForReview,
  categorySource: transactions.categorySource,
  note: transactions.note,
  accountId: transactions.accountId,
  source: transactions.source,
  createdAt: transactions.createdAt,
  updatedAt: transactions.updatedAt,
} as const;

// ─── Aliases for joined tables ────────────────────────────────────────────────────────────────────

const subcategories = alias(categories, 'subcategories');
const matchedTransactions = alias(transactions, 'matched_transactions');
const matchedAccounts = alias(accounts, 'matched_accounts');
const pairedTransactions = alias(transactions, 'paired_transactions');
const pairedAccounts = alias(accounts, 'paired_accounts');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOwnedTransaction(transactionId: string, userId: string) {
  const [txn] = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      accountId: transactions.accountId,
      isIncome: transactions.isIncome,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.id, transactionId), eq(accounts.userId, userId)))
    .limit(1);
  return txn ?? null;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listTransactions(
  userId: string,
  filters: TransactionFilters,
  pagination: PaginationParams
) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  // baseConditions holds all filters except `flagged` so that flaggedTotal
  // can be computed independently of whether the user has the flag filter on.
  const baseConditions = [eq(accounts.userId, userId)];

  if (filters.accountId)
    baseConditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.month) {
    const parts = filters.month.split('-');
    const year = parseInt(parts[0] ?? '0', 10);
    const mon = parseInt(parts[1] ?? '0', 10);
    const monthStr = String(mon).padStart(2, '0');
    const lastDay = new Date(year, mon, 0).getDate();
    baseConditions.push(gte(transactions.date, `${year}-${monthStr}-01`));
    baseConditions.push(lte(transactions.date, `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`));
  } else {
    if (filters.startDate)
      baseConditions.push(gte(transactions.date, filters.startDate));
    if (filters.endDate)
      baseConditions.push(lte(transactions.date, filters.endDate));
  }
  if (filters.categoryId === 'none')
    baseConditions.push(isNull(transactions.categoryId));
  else if (filters.categoryId)
    baseConditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.subcategoryId)
    baseConditions.push(eq(transactions.subcategoryId, filters.subcategoryId));
  if (filters.needWant)
    baseConditions.push(eq(transactions.needWant, filters.needWant));
  if (filters.isIncome !== undefined)
    baseConditions.push(eq(transactions.isIncome, filters.isIncome));
  if (filters.isTransfer !== undefined)
    baseConditions.push(eq(transactions.isTransfer, filters.isTransfer));
  if (filters.tagIds?.length) {
    const tagSubquery = db
      .select({ transactionId: transactionTags.transactionId })
      .from(transactionTags)
      .where(inArray(transactionTags.tagId, filters.tagIds));
    baseConditions.push(inArray(transactions.id, tagSubquery));
  }

  const conditions = filters.flagged
    ? [...baseConditions, eq(transactions.flaggedForReview, true)]
    : baseConditions;

  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      sourceName: transactions.sourceName,
      amount: transactions.amount,
      currency: transactions.currency,
      needWant: transactions.needWant,
      isTransfer: transactions.isTransfer,
      transferMatchId: transactions.transferMatchId,
      transferMatchDescription: matchedTransactions.description,
      transferMatchSourceName: matchedTransactions.sourceName,
      transferMatchAccountName: matchedAccounts.name,
      transferPairId: transactions.transferPairId,
      transferPairDescription: pairedTransactions.description,
      transferPairSourceName: pairedTransactions.sourceName,
      transferPairAccountName: pairedAccounts.name,
      isIncome: transactions.isIncome,
      isInvestmentContribution: transactions.isInvestmentContribution,
      flaggedForReview: transactions.flaggedForReview,
      categorySource: transactions.categorySource,
      note: transactions.note,
      accountId: transactions.accountId,
      accountName: accounts.name,
      accountInstitution: accounts.institution,
      source: transactions.source,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      subcategoryId: transactions.subcategoryId,
      subcategoryName: subcategories.name,
      rebalancingGroupId: rebalancingGroupTransactions.groupId,
      rebalancingRole: rebalancingGroupTransactions.role,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
    .leftJoin(matchedTransactions, eq(transactions.transferMatchId, matchedTransactions.id))
    .leftJoin(matchedAccounts, eq(matchedTransactions.accountId, matchedAccounts.id))
    .leftJoin(pairedTransactions, eq(transactions.transferPairId, pairedTransactions.id))
    .leftJoin(pairedAccounts, eq(pairedTransactions.accountId, pairedAccounts.id))
    .leftJoin(
      rebalancingGroupTransactions,
      eq(rebalancingGroupTransactions.transactionId, transactions.id)
    )
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(limit)
    .offset(offset);

  const txnIds = rows.map((r) => r.id);
  const tagRows =
    txnIds.length > 0
      ? await db
          .select({
            transactionId: transactionTags.transactionId,
            tagId: tags.id,
            tagName: tags.name,
            tagColor: tags.color,
          })
          .from(transactionTags)
          .innerJoin(tags, eq(transactionTags.tagId, tags.id))
          .where(inArray(transactionTags.transactionId, txnIds))
      : [];

  const tagsByTxn = tagRows.reduce<
    Record<string, { id: string; name: string; color: string | null }[]>
  >((acc, t) => {
    const tags = acc[t.transactionId] ?? [];
    acc[t.transactionId] = tags;
    tags.push({
      id: t.tagId,
      name: t.tagName,
      color: t.tagColor,
    });
    return acc;
  }, {});

  const data = rows.map((r) => ({ ...r, tags: tagsByTxn[r.id] ?? [] }));

  const [[countRow], [flaggedCountRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...conditions)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...baseConditions, eq(transactions.flaggedForReview, true))),
  ]);
  assertDefined(countRow, 'Expected count row');
  assertDefined(flaggedCountRow, 'Expected flagged count row');

  // When the flagged filter is active, conditions already includes
  // flaggedForReview = true, so both count queries return the same result.
  // We still run both in parallel (cheapest path at this data scale) and
  // simply read from flaggedCountRow in all cases.
  const flaggedTotal = Number(flaggedCountRow.count);

  return {
    data,
    flaggedTotal,
    pagination: {
      page,
      limit,
      total: Number(countRow.count),
      totalPages: Math.ceil(Number(countRow.count) / limit),
    },
  };
}

// ─── Patch ────────────────────────────────────────────────────────────────────

/** Returns the updated transaction, or null if not found / not owned. */
export async function patchTransaction(
  id: string,
  userId: string,
  input: PatchTransactionInput
) {
  const txn = await getOwnedTransaction(id, userId);
  if (!txn) return null;

  const updateData: Partial<typeof transactions.$inferInsert> = { updatedAt: new Date() };

  if (input.categoryId !== undefined) {
    updateData.categoryId = input.categoryId;
    updateData.categorySource = CATEGORY_SOURCE.MANUAL;
    updateData.categoryConfidence = CONFIDENCE.MANUAL;
    updateData.flaggedForReview = false;
  }
  if (input.subcategoryId !== undefined)
    updateData.subcategoryId = input.subcategoryId;
  // needWant is only valid on expenses — silently coerce to null for income transactions
  if (input.needWant !== undefined)
    updateData.needWant = txn.isIncome ? null : input.needWant;
  if (input.note !== undefined) updateData.note = input.note;
  // isInvestmentContribution is only valid on expenses — silently coerce to false for income transactions
  if (input.isInvestmentContribution !== undefined)
    updateData.isInvestmentContribution = txn.isIncome ? false : input.isInvestmentContribution;

  let retroactivelyApplied = 0;

  await db.transaction(async (tx) => {
    await tx.update(transactions).set(updateData).where(eq(transactions.id, id));

    if (input.createRule && input.categoryId) {
      const keyword = txn.description
        .slice(0, KEYWORD_SLICE_LENGTH)
        .toLowerCase()
        .trim();

      const existing = await tx
        .select({ id: categorizationRules.id })
        .from(categorizationRules)
        .where(
          and(
            eq(categorizationRules.userId, userId),
            eq(categorizationRules.keyword, keyword)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await tx.insert(categorizationRules).values({
          userId,
          keyword,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId ?? null,
          needWant: input.needWant ?? null,
          priority: AUTO_RULE_PRIORITY,
        });

        retroactivelyApplied = await applyRuleRetroactively(
          tx,
          {
            keyword,
            matchType: 'substring',
            categoryId: input.categoryId,
            subcategoryId: input.subcategoryId ?? null,
            // 'NA' is a valid transaction needWant but not meaningful as a rule target
            needWant: input.needWant === 'NA' ? null : (input.needWant ?? null),
            sourceName: null,
            flagForReview: false,
          },
          userId
        );
      }
    }
  });

  const [updated] = await db
    .select(patchTransactionColumns)
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);

  return updated ? { transaction: updated, retroactivelyApplied } : null;
}

// ─── Create (manual entry) ────────────────────────────────────────────────────

/** Returns null if the account was not found or doesn't belong to the user. */
export async function createManualTransaction(
  userId: string,
  input: CreateTransactionInput
) {
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!account)
    throw new TransactionError(TransactionErrorCode.ACCOUNT_NOT_FOUND);

  const normDesc = input.description.toLowerCase().trim().replace(/\s+/g, '-');
  const compositeKey = `${input.accountId}-${input.date}-${normDesc}-${input.amount}`;
  const isIncome = input.isIncome ?? input.amount > 0;

  const [created] = await db
    .insert(transactions)
    .values({
      accountId: input.accountId,
      importId: null,
      date: input.date,
      description: input.description.toLowerCase().trim(),
      rawDescription: input.description,
      amount: String(input.amount),
      currency: input.currency,
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null,
      needWant: isIncome ? null : (input.needWant ?? null),
      categorySource: input.categoryId
        ? CATEGORY_SOURCE.MANUAL
        : CATEGORY_SOURCE.DEFAULT,
      categoryConfidence: input.categoryId ? CONFIDENCE.MANUAL : null,
      isTransfer: false,
      isIncome,
      flaggedForReview: !input.categoryId,
      compositeKey,
      note: input.note ?? null,
      source: TRANSACTION_SOURCE.MANUAL,
    })
    .returning();

  return created;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Deletes a transaction. Handles two side-effects atomically:
 * - If part of a confirmed transfer pair, clears the pair's transferPairId.
 * - If part of a rebalancing group, flags the group for review and sets it
 *   back to 'open' if the deleted transaction was the only source.
 *
 * Returns true if deleted, false if not found / not owned.
 */
export async function deleteTransaction(
  id: string,
  userId: string
): Promise<boolean> {
  const [txn] = await db
    .select({
      id: transactions.id,
      transferPairId: transactions.transferPairId,
      transferMatchId: transactions.transferMatchId,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.id, id), eq(accounts.userId, userId)))
    .limit(1);

  if (!txn) return false;

  const [membership] = await db
    .select({
      groupId: rebalancingGroupTransactions.groupId,
      role: rebalancingGroupTransactions.role,
    })
    .from(rebalancingGroupTransactions)
    .where(eq(rebalancingGroupTransactions.transactionId, id))
    .limit(1);

  if (txn.transferPairId || txn.transferMatchId || membership) {
    const pairId = txn.transferPairId;
    const matchId = txn.transferMatchId;
    await db.transaction(async (tx) => {
      if (pairId) {
        // Reset the surviving pair — it is no longer part of a confirmed transfer
        await tx
          .update(transactions)
          .set({ isTransfer: false, transferPairId: null })
          .where(eq(transactions.id, pairId));
      }
      if (matchId) {
        // Clear the dangling suggestion on the candidate that pointed to this transaction
        await tx
          .update(transactions)
          .set({ transferMatchId: null })
          .where(eq(transactions.id, matchId));
      }
      // CASCADE removes the rebalancing_group_transactions row automatically.
      await tx.delete(transactions).where(eq(transactions.id, id));
      if (membership) {
        await updateGroupAfterMemberRemoval(
          tx,
          membership.groupId,
          membership.role as RebalancingRole
        );
      }
    });
  } else {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  return true;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

/** Returns null if the transaction was not found / not owned. Throws TAG_NOT_FOUND if the tag doesn't exist. */
export async function addTagToTransaction(
  transactionId: string,
  userId: string,
  tagId: string
): Promise<true | null> {
  const txn = await getOwnedTransaction(transactionId, userId);
  if (!txn) return null;

  const [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
    .limit(1);

  if (!tag) throw new TransactionError(TransactionErrorCode.TAG_NOT_FOUND);

  await db
    .insert(transactionTags)
    .values({ transactionId, tagId })
    .onConflictDoNothing();

  return true;
}

export async function removeTagFromTransaction(
  transactionId: string,
  userId: string,
  tagId: string
): Promise<boolean> {
  const txn = await getOwnedTransaction(transactionId, userId);
  if (!txn) return false;

  await db
    .delete(transactionTags)
    .where(
      and(
        eq(transactionTags.transactionId, transactionId),
        eq(transactionTags.tagId, tagId)
      )
    );

  return true;
}

// ─── Retroactive Rule Application ────────────────────────────────────────────

export interface RetroactiveRule {
  keyword: string;
  matchType: 'substring' | 'wildcard';
  categoryId: string | null;
  subcategoryId: string | null;
  needWant: NeedWant | null;
  sourceName: string | null;
  flagForReview: boolean;
}

/**
 * Applies a single rule to all eligible transactions (categorySource in
 * 'default' | 'ai', non-transfer) within an existing DB transaction. Intended
 * to be called immediately after a rule is created so existing miscategorized
 * transactions are corrected in the same atomic operation.
 *
 * Returns the number of transactions updated.
 */
export async function applyRuleRetroactively(
  tx: DbTransaction,
  rule: RetroactiveRule,
  userId: string
): Promise<number> {
  const candidates = await tx
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
        ])
      )
    );

  if (candidates.length === 0) return 0;

  // TODO: For the substring case, a WHERE LOWER(description) LIKE '%keyword%' pre-filter
  // would avoid loading all eligible transactions into memory. Fine at personal-finance
  // scale; revisit if transaction counts grow into the tens of thousands.

  // id/userId/priority are not used by applyRules — placeholders are fine here.
  const loadedRule: LoadedRule = {
    id: '',
    userId,
    keyword: rule.keyword,
    matchType: rule.matchType,
    categoryId: rule.categoryId,
    subcategoryId: rule.subcategoryId,
    needWant: rule.needWant,
    sourceName: rule.sourceName,
    flagForReview: rule.flagForReview,
    priority: 0,
  };

  const now = new Date();
  const sharedValues = {
    categoryId: rule.flagForReview ? null : rule.categoryId,
    subcategoryId: rule.flagForReview ? null : rule.subcategoryId,
    sourceName: rule.sourceName,
    categorySource: CATEGORY_SOURCE.RULE,
    categoryConfidence: String(CONFIDENCE.RULE),
    flaggedForReview: rule.flagForReview,
    updatedAt: now,
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

  return total;
}

// ─── Apply Rules ──────────────────────────────────────────────────────────────

/**
 * Fetches candidates for rule application: non-transfer transactions with a
 * default or AI-assigned categorization. Rules overwrite both sources.
 * Manual and rule-applied transactions are implicitly excluded by not being in
 * the target set, preventing idempotency violations on repeated Apply Rules runs.
 */
async function fetchRuleApplicableTransactions(userId: string) {
  return db
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
        ])
      )
    );
}

/**
 * Runs all of the user's categorization rules against their unresolved
 * transactions (uncategorized or flagged-for-review, excluding transfers).
 * Manually-categorized transactions are never overwritten.
 *
 * Returns a count of how many transactions were updated vs skipped.
 */
export async function applyRulesToUncategorized(
  userId: string
): Promise<{ applied: number; skipped: number }> {
  const rules = await loadRules(userId);
  if (rules.length === 0) return { applied: 0, skipped: 0 };

  const candidates = await fetchRuleApplicableTransactions(userId);
  if (candidates.length === 0) return { applied: 0, skipped: 0 };

  // Map from a fingerprint of the update values → list of transaction ids that
  // should receive those values. Grouping lets us do one inArray UPDATE per
  // unique categorization outcome rather than one UPDATE per transaction.
  const groups = new Map<
    string,
    {
      ids: string[];
      values: {
        categoryId: string | null;
        subcategoryId: string | null;
        needWant: string | null;
        sourceName: string | null;
        categorySource: string;
        categoryConfidence: string;
        flaggedForReview: boolean;
        updatedAt: Date;
      };
    }
  >();

  let skipped = 0;
  const now = new Date();

  for (const txn of candidates) {
    const result = applyRules(txn.description, rules);
    if (!result) {
      skipped++;
      continue;
    }

    const effectiveNeedWant = txn.isIncome ? null : result.needWant;
    const fingerprint = JSON.stringify({
      categoryId: result.categoryId,
      subcategoryId: result.subcategoryId,
      needWant: effectiveNeedWant,
      sourceName: result.sourceName,
      categorySource: result.categorySource,
      flaggedForReview: result.flaggedForReview,
    });

    const existing = groups.get(fingerprint);
    if (existing) {
      existing.ids.push(txn.id);
    } else {
      groups.set(fingerprint, {
        ids: [txn.id],
        values: {
          categoryId: result.categoryId,
          subcategoryId: result.subcategoryId,
          needWant: effectiveNeedWant,
          sourceName: result.sourceName,
          categorySource: result.categorySource,
          categoryConfidence: String(result.categoryConfidence),
          flaggedForReview: result.flaggedForReview,
          updatedAt: now,
        },
      });
    }
  }

  const applied = candidates.length - skipped;
  if (applied === 0) return { applied: 0, skipped };

  await db.transaction(async (tx) => {
    for (const { ids, values } of groups.values()) {
      await tx
        .update(transactions)
        .set(values)
        .where(inArray(transactions.id, ids));
    }
  });

  return { applied, skipped };
}
