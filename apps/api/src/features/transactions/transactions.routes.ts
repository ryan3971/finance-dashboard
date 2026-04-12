import { getAuthUser, requireAuth } from '@/lib/auth';
import { ISO_DATE_REGEX, PAGINATION } from '@finance/shared/constants';
import type { Request, Response } from 'express';
import { listTransactions } from './transactions.service';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const isoDate = z.string().regex(ISO_DATE_REGEX, 'Must be YYYY-MM-DD');

const listQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  categoryId: z.string().uuid().optional(),
  flagged: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.EXPORT_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
});

// GET /api/v1/transactions
router.get('/', async (req: Request, res: Response) => {
  const { accountId, startDate, endDate, categoryId, flagged, page, limit } =
    listQuerySchema.parse(req.query);

  const result = await listTransactions(
    getAuthUser(req).id,
    {
      accountId: accountId,
      startDate: startDate,
      endDate: endDate,
      categoryId: categoryId,
      flagged: flagged ?? false,
    },
    { page, limit }
  );

  res.json(result);
});

export default router;
