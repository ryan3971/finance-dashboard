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
  // tagIds arrives as a repeated param (?tagIds=a&tagIds=b) or a single string
  tagIds: z
    .union([z.array(z.string()), z.string().transform((v) => [v])])
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
  const {
    accountId,
    startDate,
    endDate,
    month,
    categoryId,
    subcategoryId,
    needWant,
    flagged,
    isIncome,
    isTransfer,
    tagIds,
    page,
    limit,
  } = listQuerySchema.parse(req.query);

  const result = await listTransactions(
    getAuthUser(req).id,
    {
      accountId,
      startDate,
      endDate,
      month,
      categoryId,
      subcategoryId,
      needWant,
      flagged: flagged ?? false,
      isIncome,
      isTransfer,
      tagIds,
    },
    { page, limit }
  );

  res.json(result);
});

export default router;
