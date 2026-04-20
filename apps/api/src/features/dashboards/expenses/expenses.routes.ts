import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { getAuthUser, requireAuth } from '@/lib/auth';
import {
  buildExpensesResponse,
  queryExpensesByCategory,
  queryMonthlyExpenses,
} from './expenses.service';
import {
  applyRebalancingToCategories,
  computeRebalancingAdjustments,
  queryResolvedGroupTransactions,
} from '@/pipelines/rebalancing/rebalancing-adjustments';

const router = Router();
router.use(requireAuth);

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR),
});

// GET /api/v1/dashboard/expenses?year=YYYY
router.get('/expenses', async (req: Request, res: Response) => {
  const { year } = yearQuerySchema.parse(req.query);
  const userId = getAuthUser(req).id;

  const [rows, resolvedRows] = await Promise.all([
    queryMonthlyExpenses(userId, year),
    queryResolvedGroupTransactions(userId),
  ]);

  const adjustments = computeRebalancingAdjustments(resolvedRows, year);
  res.json(buildExpensesResponse(year, rows, adjustments));
});

// GET /api/v1/dashboard/expenses/categories?year=YYYY
router.get('/expenses/categories', async (req: Request, res: Response) => {
  const { year } = yearQuerySchema.parse(req.query);
  const userId = getAuthUser(req).id;

  const [rows, resolvedRows] = await Promise.all([
    queryExpensesByCategory(userId, year),
    queryResolvedGroupTransactions(userId),
  ]);

  const adjustments = computeRebalancingAdjustments(resolvedRows, year);
  res.json({ year, rows: applyRebalancingToCategories(rows, adjustments) });
});

export default router;
