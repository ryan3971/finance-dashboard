import {
  accounts,
  categories,
  categorizationRules,
  tags,
  transactions,
  transactionTags,
} from '@/db/schema';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { TransactionError, TransactionErrorCode } from './transactions.errors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransactionFilters {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  flagged?: boolean;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PatchTransactionInput {
  categoryId?: string | null;
  subcategoryId?: string | null;
  needWant?: 'Need' | 'Want' | 'NA' | null;
  note?: string | null;
  createRule?: boolean;
}

export interface CreateTransactionInput {
  accountId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  needWant?: 'Need' | 'Want' | 'NA' | null;
  note?: string | null;
  isIncome?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOwnedTransaction(transactionId: string, userId: string) {
  const [txn] = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      accountId: transactions.accountId,
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

  const conditions = [eq(accounts.userId, userId)];

  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.startDate) conditions.push(gte(transactions.date, filters.startDate));
  if (filters.endDate) conditions.push(lte(transactions.date, filters.endDate));
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.flagged) conditions.push(eq(transactions.flaggedForReview, true));

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
      isIncome: transactions.isIncome,
      flaggedForReview: transactions.flaggedForReview,
      categorySource: transactions.categorySource,
      note: transactions.note,
      accountId: transactions.accountId,
      accountName: accounts.name,
      accountInstitution: accounts.institution,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
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
    if (!acc[t.transactionId]) acc[t.transactionId] = [];
    acc[t.transactionId].push({ id: t.tagId, name: t.tagName, color: t.tagColor });
    return acc;
  }, {});

  const data = rows.map((r) => ({ ...r, tags: tagsByTxn[r.id] ?? [] }));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...conditions));

  return {
    data,
    pagination: {
      page,
      limit,
      total: Number(count),
      totalPages: Math.ceil(Number(count) / limit),
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

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.categoryId !== undefined) {
    updateData.categoryId = input.categoryId;
    updateData.categorySource = 'manual';
    updateData.categoryConfidence = '1.000';
    updateData.flaggedForReview = false;
  }
  if (input.subcategoryId !== undefined) updateData.subcategoryId = input.subcategoryId;
  if (input.needWant !== undefined) updateData.needWant = input.needWant;
  if (input.note !== undefined) updateData.note = input.note;

  await db.update(transactions).set(updateData).where(eq(transactions.id, id));

  if (input.createRule && input.categoryId) {
    const keyword = txn.description.slice(0, 40).toLowerCase().trim();

    const existing = await db
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
      await db.insert(categorizationRules).values({
        userId,
        keyword,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId ?? null,
        needWant: input.needWant ?? null,
        priority: 5,
      });
    }
  }

  const [updated] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);

  return updated;
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

  if (!account) throw new TransactionError(TransactionErrorCode.ACCOUNT_NOT_FOUND);

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
      needWant: input.needWant ?? null,
      categorySource: input.categoryId ? 'manual' : 'default',
      categoryConfidence: input.categoryId ? '1.000' : null,
      isTransfer: false,
      isIncome,
      flaggedForReview: !input.categoryId,
      compositeKey,
      note: input.note ?? null,
      source: 'manual',
    })
    .returning();

  return created;
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