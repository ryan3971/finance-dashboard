import {
  accounts,
  categories,
  tags,
  transactions,
  transactionTags,
} from '@/db/schema';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { db } from '@/db';
import { requireAuth } from '@/lib/auth';
import { Router } from 'express';

const router = Router();

// GET /api/v1/transactions
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        account_id,
        start_date,
        end_date,
        category_id,
        flagged,
        page = '1',
        limit = '50',
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      const conditions = [eq(accounts.userId, req.user!.id)];

      if (account_id) conditions.push(eq(transactions.accountId, account_id));
      if (start_date) conditions.push(gte(transactions.date, start_date));
      if (end_date) conditions.push(lte(transactions.date, end_date));
      if (category_id)
        conditions.push(eq(transactions.categoryId, category_id));
      if (flagged === 'true')
        conditions.push(eq(transactions.flaggedForReview, true));

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
        .limit(limitNum)
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

      // Group tags by transaction ID
      const tagsByTxn = tagRows.reduce<
        Record<
          string,
          {
            id: string;
            name: string;
            color: string | null;
          }[]
        >
      >((acc, t) => {
        if (!acc[t.transactionId]) acc[t.transactionId] = [];
        acc[t.transactionId].push({
          id: t.tagId,
          name: t.tagName,
          color: t.tagColor,
        });
        return acc;
      }, {});

      // Attach tags to each row before responding
      const rowsWithTags = rows.map((r) => ({
        ...r,
        tags: tagsByTxn[r.id] ?? [],
      }));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .where(and(...conditions));

      res.json({
        data: rowsWithTags,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: Number(count),
          totalPages: Math.ceil(Number(count) / limitNum),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
