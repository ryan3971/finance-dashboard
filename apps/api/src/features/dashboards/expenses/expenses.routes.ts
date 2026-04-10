import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { getAuthUser, requireAuth } from '@/lib/auth';
import {
  buildExpensesResponse,
  queryExpensesByCategory,
  queryMonthlyExpenses,
} from './expenses.service';

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
  const rows = await queryMonthlyExpenses(userId, year);
  res.json(buildExpensesResponse(year, rows));
});

// GET /api/v1/dashboard/expenses/categories?year=YYYY
router.get('/expenses/categories', async (req: Request, res: Response) => {
  const { year } = yearQuerySchema.parse(req.query);
  const userId = getAuthUser(req).id;
  const rows = await queryExpensesByCategory(userId, year);
  res.json({ year, rows });
});

export default router;
