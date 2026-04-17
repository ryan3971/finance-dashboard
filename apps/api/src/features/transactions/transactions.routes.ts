import { getAuthUser, requireAuth } from '@/lib/auth';
import { PAGINATION } from '@finance/shared/constants';
import type { Request, Response } from 'express';
import { listTransactions } from './transactions.service';
import { Router } from 'express';
import { z } from 'zod';
import { transactionFiltersSchema } from '@finance/shared/schemas/transactions';

const router = Router();
router.use(requireAuth);

const booleanParam = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

const listQuerySchema = transactionFiltersSchema.extend({
  // Query params arrive as strings — override the boolean fields with string→boolean transforms
  flagged: booleanParam,
  isIncome: booleanParam,
  isTransfer: booleanParam,
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
  const { accountId, startDate, endDate, categoryId, subcategoryId, flagged, isIncome, page, limit } =
    listQuerySchema.parse(req.query);

  const result = await listTransactions(
    getAuthUser(req).id,
    {
      accountId: accountId,
      startDate: startDate,
      endDate: endDate,
      categoryId: categoryId,
      subcategoryId: subcategoryId,
      flagged: flagged ?? false,
      isIncome,
    },
    { page, limit }
  );

  res.json(result);
});

export default router;
