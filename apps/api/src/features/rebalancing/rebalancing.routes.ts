import { Router } from 'express';
import type { Request, Response } from 'express';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { idParamsSchema } from '@/lib/common-schemas';
import { z } from 'zod';
import {
  addGroupTransactionSchema,
  createRebalancingGroupSchema,
  updateRebalancingGroupSchema,
} from '@finance/shared/schemas/rebalancing';
import {
  addGroupTransaction,
  createGroup,
  deleteGroup,
  getGroup,
  listGroups,
  removeGroupTransaction,
  updateGroup,
} from './rebalancing.service';

const router = Router();
router.use(requireAuth);

const memberParamsSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
});

// GET /api/v1/rebalancing/groups
router.get('/groups', async (req: Request, res: Response) => {
  const result = await listGroups(getAuthUser(req).id);
  res.json(result);
});

// POST /api/v1/rebalancing/groups
router.post('/groups', async (req: Request, res: Response) => {
  const input = createRebalancingGroupSchema.parse(req.body);
  const group = await createGroup(getAuthUser(req).id, input);
  res.status(201).json(group);
});

// GET /api/v1/rebalancing/groups/:id
router.get('/groups/:id', async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const group = await getGroup(id, getAuthUser(req).id);
  if (!group) {
    res.status(404).json({ error: 'Rebalancing group not found' });
    return;
  }
  res.json(group);
});

// PATCH /api/v1/rebalancing/groups/:id
router.patch('/groups/:id', async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const patch = updateRebalancingGroupSchema.parse(req.body);
  const group = await updateGroup(id, getAuthUser(req).id, patch);
  if (!group) {
    res.status(404).json({ error: 'Rebalancing group not found' });
    return;
  }
  res.json(group);
});

// DELETE /api/v1/rebalancing/groups/:id
router.delete('/groups/:id', async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const deleted = await deleteGroup(id, getAuthUser(req).id);
  if (!deleted) {
    res.status(404).json({ error: 'Rebalancing group not found' });
    return;
  }
  res.status(204).send();
});

// POST /api/v1/rebalancing/groups/:id/transactions
router.post(
  '/groups/:id/transactions',
  async (req: Request, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    const input = addGroupTransactionSchema.parse(req.body);
    const group = await addGroupTransaction(id, getAuthUser(req).id, input);
    if (!group) {
      res.status(404).json({ error: 'Rebalancing group not found' });
      return;
    }
    res.status(201).json(group);
  }
);

// DELETE /api/v1/rebalancing/groups/:id/transactions/:transactionId
router.delete(
  '/groups/:id/transactions/:transactionId',
  async (req: Request, res: Response) => {
    const { id, transactionId } = memberParamsSchema.parse(req.params);
    const group = await removeGroupTransaction(
      id,
      getAuthUser(req).id,
      transactionId
    );
    if (!group) {
      res.status(404).json({ error: 'Rebalancing group not found' });
      return;
    }
    res.json(group);
  }
);

export default router;
