import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAuthUser, requireAuth } from '@/lib/auth';
import {
  createManualInvestmentTransactionSchema,
  updateRiskLevelSchema,
  updateRiskSettingsSchema,
  upsertContributionRoomSchema,
} from '@finance/shared/schemas/investments';
import {
  createManualInvestmentTransaction,
  updateRiskSettings,
  updateTransactionRiskLevel,
  upsertContributionRoom,
} from './investments.service';

const router = Router();
router.use(requireAuth);

// POST /api/v1/investments/transactions
router.post('/transactions', async (req: Request, res: Response) => {
  const input = createManualInvestmentTransactionSchema.parse(req.body);
  const result = await createManualInvestmentTransaction(getAuthUser(req).id, input);
  res.status(201).json(result);
});

// PATCH /api/v1/investments/risk-settings
router.patch('/risk-settings', async (req: Request, res: Response) => {
  const body = updateRiskSettingsSchema.parse(req.body);
  await updateRiskSettings(getAuthUser(req).id, body);
  res.status(204).send();
});

const transactionRiskLevelParamsSchema = z.object({
  id: z.string().uuid(),
});

// PATCH /api/v1/investments/transactions/:id/risk-level
router.patch('/transactions/:id/risk-level', async (req: Request, res: Response) => {
  const { id } = transactionRiskLevelParamsSchema.parse(req.params);
  const body = updateRiskLevelSchema.parse(req.body);
  await updateTransactionRiskLevel(getAuthUser(req).id, id, body);
  res.status(200).json({ ok: true });
});

const contributionRoomParamsSchema = z.object({
  accountId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
});

// PUT /api/v1/investments/contribution-room/:accountId/:year
router.put(
  '/contribution-room/:accountId/:year',
  async (req: Request, res: Response) => {
    const { accountId, year } = contributionRoomParamsSchema.parse(req.params);
    const body = upsertContributionRoomSchema.parse(req.body);
    await upsertContributionRoom(getAuthUser(req).id, accountId, year, body);
    res.status(204).send();
  }
);

export default router;
