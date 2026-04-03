import type { Request, Response } from 'express';
import {
  addTagToTransaction,
  createManualTransaction,
  patchTransaction,
  removeTagFromTransaction,
} from './transactions.service';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const patchTransactionSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  needWant: z.enum(['Need', 'Want', 'NA']).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  createRule: z.boolean().optional().default(false),
});

const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(1).max(500),
  amount: z.number(),
  currency: z.string().length(3).default('CAD'),
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  needWant: z.enum(['Need', 'Want', 'NA']).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  isIncome: z.boolean().optional(),
});

const transactionParamsSchema = z.object({ id: z.string().uuid() });

const tagParamsSchema = z.object({
  id: z.string().uuid(),
  tagId: z.string().uuid(),
});

// ─── PATCH /api/v1/transactions/:id ──────────────────────────────────────────

router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const input = patchTransactionSchema.parse(req.body);
  const { id } = transactionParamsSchema.parse(req.params);
  const updated = await patchTransaction(id, getAuthUser(req).id, input);
  if (!updated) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  res.json(updated);
});

// ─── POST /api/v1/transactions (manual entry) ────────────────────────────────

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const input = createTransactionSchema.parse(req.body);
  const created = await createManualTransaction(getAuthUser(req).id, input);
  res.status(201).json(created);
});

// ─── POST /api/v1/transactions/:id/tags ──────────────────────────────────────

router.post('/:id/tags', requireAuth, async (req: Request, res: Response) => {
  const { tagId } = z.object({ tagId: z.string().uuid() }).parse(req.body);
  const { id } = transactionParamsSchema.parse(req.params);

  const found = await addTagToTransaction(id, getAuthUser(req).id, tagId);
  if (!found) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  res.status(201).json({ transactionId: id, tagId });
});

// ─── DELETE /api/v1/transactions/:id/tags/:tagId ─────────────────────────────

router.delete(
  '/:id/tags/:tagId',
  requireAuth,
  async (req: Request, res: Response) => {
    const { id, tagId } = tagParamsSchema.parse(req.params);
    const found = await removeTagFromTransaction(
      id,
      getAuthUser(req).id,
      tagId
    );
    if (!found) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    res.status(204).send();
  }
);

export default router;
