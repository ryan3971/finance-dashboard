import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { transactions, accounts, categories } from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/v1/transactions
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
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
    if (category_id) conditions.push(eq(transactions.categoryId, category_id));
    if (flagged === 'true') conditions.push(eq(transactions.flaggedForReview, true));

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

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...conditions));

    res.json({
      data: rows,
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
});

export default router;
