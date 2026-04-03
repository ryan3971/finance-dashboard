import type { Request, Response } from 'express';
import { listTransactions } from './transactions.service';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

const listQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
  category_id: z.string().uuid().optional(),
  flagged: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// GET /api/v1/transactions
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response) => {
    const { account_id, start_date, end_date, category_id, flagged, page, limit } =
      listQuerySchema.parse(req.query);

    const result = await listTransactions(
      getAuthUser(req).id,
      {
        accountId: account_id,
        startDate: start_date,
        endDate: end_date,
        categoryId: category_id,
        flagged: flagged ?? false,
      },
      { page, limit }
    );

    res.json(result);
  }
);

export default router;