import { Router } from 'express';
import type { Request, Response } from 'express';
import { getAuthUser, requireAuth } from '@/lib/auth';
import {
  contributionRoomQuerySchema,
  investmentSummaryQuerySchema,
  investmentTransactionFiltersSchema,
  monthlyBreakdownQuerySchema,
} from '@finance/shared/schemas/investments';
import {
  getActivitySummary,
  getContributionRoom,
  getInvestmentTransactions,
  getMonthlyBreakdown,
} from './investments.service';

const router = Router();
router.use(requireAuth);

// GET /api/v1/investments/transactions
router.get('/transactions', async (req: Request, res: Response) => {
  const filters = investmentTransactionFiltersSchema.parse(req.query);
  const result = await getInvestmentTransactions(getAuthUser(req).id, filters);
  res.json(result);
});

// GET /api/v1/investments/summary
router.get('/summary', async (req: Request, res: Response) => {
  const { year, accountId } = investmentSummaryQuerySchema.parse(req.query);
  const result = await getActivitySummary(getAuthUser(req).id, year, accountId);
  res.json(result);
});

// GET /api/v1/investments/contribution-room
router.get('/contribution-room', async (req: Request, res: Response) => {
  const { year } = contributionRoomQuerySchema.parse(req.query);
  const result = await getContributionRoom(getAuthUser(req).id, year);
  res.json(result);
});

// GET /api/v1/investments/monthly-breakdown
router.get('/monthly-breakdown', async (req: Request, res: Response) => {
  const { year } = monthlyBreakdownQuerySchema.parse(req.query);
  const result = await getMonthlyBreakdown(getAuthUser(req).id, year);
  res.json(result);
});

export default router;
