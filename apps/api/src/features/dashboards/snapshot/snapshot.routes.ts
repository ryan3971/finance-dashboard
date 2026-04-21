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

// GET /api/v1/dashboard/snapshot
router.get('/snapshot', async (req: Request, res: Response) => {
  const userId = getAuthUser(req).id;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

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
