import type { NextFunction, Request, Response } from 'express';
import {
  addTagToTransaction,
  createManualTransaction,
  patchTransaction,
  removeTagFromTransaction,
} from './transactions.service';
import { requireAuth } from '@/lib/auth';
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

// ─── PATCH /api/v1/transactions/:id ──────────────────────────────────────────

router.patch(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = patchTransactionSchema.parse(req.body);
      const updated = await patchTransaction(req.params.id, req.user!.id, input);
      if (!updated) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/transactions (manual entry) ────────────────────────────────

router.post(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createTransactionSchema.parse(req.body);
      const created = await createManualTransaction(req.user!.id, input);
      if (!created) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/transactions/:id/tags ──────────────────────────────────────

router.post(
  '/:id/tags',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tagId } = z.object({ tagId: z.string().uuid() }).parse(req.body);
      const result = await addTagToTransaction(req.params.id, req.user!.id, tagId);

      if (result === 'transaction_not_found') {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      if (result === 'tag_not_found') {
        res.status(404).json({ error: 'Tag not found' });
        return;
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /api/v1/transactions/:id/tags/:tagId ─────────────────────────────

router.delete(
  '/:id/tags/:tagId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const found = await removeTagFromTransaction(
        req.params.id,
        req.user!.id,
        req.params.tagId
      );
      if (!found) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;