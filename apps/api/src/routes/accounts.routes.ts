import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { accounts } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();

const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['chequing', 'savings', 'credit', 'tfsa', 'fhsa', 'rrsp', 'non-registered']),
  institution: z.enum(['amex', 'cibc', 'td', 'questrade', 'manual']),
  currency: z.string().length(3).default('CAD'),
  isCredit: z.boolean().default(false),
});

// GET /api/v1/accounts
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, req.user!.id), eq(accounts.isActive, true)));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/accounts
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAccountSchema.parse(req.body);

    const [account] = await db
      .insert(accounts)
      .values({ ...input, userId: req.user!.id })
      .returning();

    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/accounts/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, req.params.id), eq(accounts.userId, req.user!.id)))
      .limit(1);

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    res.json(account);
  } catch (err) {
    next(err);
  }
});

export default router;
