/**
 * Accounts Routes
 *
 * Defines the Express router for the /api/v1/accounts endpoint. All routes
 * require authentication via the requireAuth middleware.
 *
 * Routes:
 *   GET    /          - List all accounts for the authenticated user
 *   POST   /          - Create a new account (validated via createAccountSchema)
 *   GET    /:id       - Retrieve a single account by ID
 *
 * Supported account types: chequing, savings, credit, tfsa, fhsa, rrsp, non-registered
 * Supported institutions:  amex, cibc, td, questrade, manual
 */
import { type Request, type Response, Router } from 'express';
import {
  createAccount,
  getAccountById,
  listAccounts,
} from './accounts.services';
import { AccountError, AccountErrorCode } from './accounts.errors';
import { requireAuth } from '@/lib/auth';
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
});

// GET /api/v1/accounts
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await listAccounts(req.user!.id);
    res.json(result);
  }
);

// POST /api/v1/accounts
router.post(
  '/',
  requireAuth,
  async (req: Request, res: Response) => {
    const input = createAccountSchema.parse(req.body);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const account = await createAccount(req.user!.id, input);
    res.status(201).json(account);
  }
);

// GET /api/v1/accounts/:id
router.get(
  '/:id',
  requireAuth,
  async (req: Request<{ id: string }>, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const account = await getAccountById(req.params.id, req.user!.id);

    if (!account) {
      throw new AccountError(AccountErrorCode.NOT_FOUND);
    }

    res.json(account);
  }
);

export default router;
