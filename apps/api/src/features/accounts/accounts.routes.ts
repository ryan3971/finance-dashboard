import { accountFormSchema } from '@finance/shared';
import { AccountError, AccountErrorCode } from './accounts.errors';
import {
  createAccount,
  getAccountById,
  listAccounts,
} from './accounts.services';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { type Request, type Response, Router } from 'express';

const router = Router();
router.use(requireAuth);

// GET /api/v1/accounts
router.get('/', async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === 'true';
  const result = await listAccounts(getAuthUser(req).id, { includeInactive });
  res.json(result);
});

// POST /api/v1/accounts
router.post('/', async (req: Request, res: Response) => {
  const input = accountFormSchema.parse(req.body);
  const account = await createAccount(getAuthUser(req).id, input);
  res.status(201).json(account);
});

// GET /api/v1/accounts/:id
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const account = await getAccountById(req.params.id, getAuthUser(req).id);

  if (!account) {
    throw new AccountError(AccountErrorCode.NOT_FOUND);
  }

  res.json(account);
});

export default router;
