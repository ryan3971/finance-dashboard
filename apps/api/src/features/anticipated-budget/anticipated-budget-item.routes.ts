import type { Request, Response } from 'express';
import { Router } from 'express';
import {
  updateAnticipatedBudgetSchema,
  upsertMonthOverrideSchema,
} from '@finance/shared/schemas/anticipated-budget';
import {
  AnticipatedBudgetError,
  AnticipatedBudgetErrorCode,
} from './anticipated-budget.errors';
import {
  deleteEntry,
  deleteMonthOverride,
  updateEntry,
  upsertMonthOverride,
} from './anticipated-budget.service';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { idParamsSchema } from '@/lib/common-schemas';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const monthRouteParamsSchema = idParamsSchema.extend({
  month: z.coerce.number().int().min(1).max(12),
});

// PATCH /anticipated-budget/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const patch = updateAnticipatedBudgetSchema.parse(req.body);
  const updated = await updateEntry(id, getAuthUser(req).id, patch);
  if (!updated) throw new AnticipatedBudgetError(AnticipatedBudgetErrorCode.NOT_FOUND);
  res.json(updated);
});

// DELETE /anticipated-budget/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const found = await deleteEntry(id, getAuthUser(req).id);
  if (!found) throw new AnticipatedBudgetError(AnticipatedBudgetErrorCode.NOT_FOUND);
  res.status(204).send();
});

// PUT /anticipated-budget/:id/months/:month
router.put('/:id/months/:month', async (req: Request, res: Response) => {
  const { id, month } = monthRouteParamsSchema.parse(req.params);
  const input = upsertMonthOverrideSchema.parse(req.body);
  await upsertMonthOverride(id, getAuthUser(req).id, month, input);
  res.status(204).send();
});

// DELETE /anticipated-budget/:id/months/:month
router.delete('/:id/months/:month', async (req: Request, res: Response) => {
  const { id, month } = monthRouteParamsSchema.parse(req.params);
  const found = await deleteMonthOverride(id, getAuthUser(req).id, month);
  if (!found) throw new AnticipatedBudgetError(AnticipatedBudgetErrorCode.MONTH_OVERRIDE_NOT_FOUND);
  res.status(204).send();
});

export default router;
