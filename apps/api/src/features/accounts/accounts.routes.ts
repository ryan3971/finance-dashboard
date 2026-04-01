import type { NextFunction, Request, Response } from 'express';
import { createAccount, getAccountById, listAccounts } from './accounts.services';
import { requireAuth } from '@/lib/auth';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    'chequing',
    'savings',
    'credit',
    'tfsa',
    'fhsa',
    'rrsp',
    'non-registered',
  ]),
  institution: z.enum(['amex', 'cibc', 'td', 'questrade', 'manual']),
  currency: z.string().length(3).default('CAD'),
  isCredit: z.boolean().default(false),
});

// GET /api/v1/accounts
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listAccounts(req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/accounts
router.post(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createAccountSchema.parse(req.body);
      const account = await createAccount(req.user!.id, input);
      res.status(201).json(account);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/accounts/:id
router.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await getAccountById(req.params.id, req.user!.id);
      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }
      res.json(account);
    } catch (err) {
      next(err);
    }
  }
);

export default router;