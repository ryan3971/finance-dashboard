import type { Request, Response } from 'express';
import { Router } from 'express';
import { createAnticipatedBudgetSchema } from '@finance/shared/schemas/anticipated-budget';
import { createEntry, listEntries } from './anticipated-budget.service';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

// GET /anticipated-budget?year=2024
router.get('/', async (req: Request, res: Response) => {
  const { year } = yearQuerySchema.parse(req.query);
  const entries = await listEntries(getAuthUser(req).id, year);
  res.json(entries);
});

// POST /anticipated-budget
router.post('/', async (req: Request, res: Response) => {
  const input = createAnticipatedBudgetSchema.parse(req.body);
  const entry = await createEntry(getAuthUser(req).id, input);
  res.status(201).json(entry);
});

export default router;