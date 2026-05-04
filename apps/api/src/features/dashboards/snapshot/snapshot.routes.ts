import { z } from 'zod';
import { type Request, type Response, Router } from 'express';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { queryDashboardUserConfig } from '@/lib/user-config-query';
import {
  queryAccountBalances,
  queryCurrentMonthIncome,
  queryCurrentMonthExpenses,
  queryAnticipatedForMonth,
  queryLastUploadedAt,
} from './snapshot.repository';
import { buildSnapshotResponse } from './snapshot.service';
import {
  computeRebalancingAdjustments,
  queryResolvedGroupTransactions,
} from '@/pipelines/rebalancing/rebalancing-adjustments';

const router = Router();
router.use(requireAuth);

const snapshotQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

// GET /api/v1/dashboard/snapshot
// Optional query params: ?year=YYYY&month=M — defaults to the current month.
router.get('/snapshot', async (req: Request, res: Response) => {
  const userId = getAuthUser(req).id;
  const now = new Date();

  const parsed = snapshotQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid year or month parameter' });
    return;
  }

  const year = parsed.data.year ?? now.getFullYear();
  const month = parsed.data.month ?? now.getMonth() + 1;

  const [
    accountRows,
    incomeTotal,
    expenseRows,
    anticipatedRows,
    config,
    resolvedRows,
    lastUploadedAt,
  ] = await Promise.all([
    queryAccountBalances(userId),
    queryCurrentMonthIncome(userId, year, month),
    queryCurrentMonthExpenses(userId, year, month),
    queryAnticipatedForMonth(userId, year, month),
    queryDashboardUserConfig(userId),
    queryResolvedGroupTransactions(userId),
    queryLastUploadedAt(userId),
  ]);

  const adjustments = computeRebalancingAdjustments(resolvedRows, year);

  res.json(
    buildSnapshotResponse(
      accountRows,
      incomeTotal,
      expenseRows,
      anticipatedRows,
      config,
      { year, month },
      adjustments,
      lastUploadedAt
    )
  );
});

export default router;
