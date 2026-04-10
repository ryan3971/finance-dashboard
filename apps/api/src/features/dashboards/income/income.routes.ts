import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { getUserConfig } from '@/features/user-config/user-config.service';
import { buildIncomeResponse, queryMonthlyIncome } from './income.service';

const router = Router();
router.use(requireAuth);

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR),
});

// GET /api/v1/dashboard/income?year=YYYY
router.get('/income', async (req: Request, res: Response) => {
  const { year } = yearQuerySchema.parse(req.query);
  const userId = getAuthUser(req).id;

  const [rows, config] = await Promise.all([
    queryMonthlyIncome(userId, year),
    getUserConfig(userId),
  ]);

  res.json(buildIncomeResponse(year, rows, config));
});

export default router;
