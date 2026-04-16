import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { queryDashboardUserConfig } from '@/lib/user-config-query';
import {
  buildYtdResponse,
  queryYtdMonthlyExpenses,
  queryYtdMonthlyIncome,
  queryYtdMonthlyInvestmentContributions,
} from './ytd.service';

const router = Router();
router.use(requireAuth);

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR),
});

// GET /api/v1/dashboard/ytd?year=YYYY
router.get('/ytd', async (req: Request, res: Response) => {
  const { year } = yearQuerySchema.parse(req.query);
  const userId = getAuthUser(req).id;
  const today = new Date();

  const [incomeRows, expenseRows, contributionRows, config] = await Promise.all([
    queryYtdMonthlyIncome(userId, year),
    queryYtdMonthlyExpenses(userId, year),
    queryYtdMonthlyInvestmentContributions(userId, year),
    queryDashboardUserConfig(userId),
  ]);

  res.json(buildYtdResponse(year, incomeRows, expenseRows, contributionRows, today, config));
});

export default router;
