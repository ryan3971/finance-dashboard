import type { NextFunction, Request, Response } from 'express';
import { listTransactions } from './transactions.service';
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

      const result = await listTransactions(
        req.user!.id,
        {
          accountId: account_id,
          startDate: start_date,
          endDate: end_date,
          categoryId: category_id,
          flagged: flagged === 'true',
        },
        { page: pageNum, limit: limitNum }
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;