import { ACCOUNT_TYPES, INSTITUTIONS } from '@finance/shared';
import {
  deactivateAccount,
  reactivateAccount,
  updateAccount,
} from './accounts.services';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { type Request, type Response, Router } from 'express';
import { AccountError, AccountErrorCode } from './accounts.errors';

import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const paramsSchema = z.object({ id: z.string().uuid() });

const patchAccountSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    institution: z.enum(INSTITUTIONS).optional(),
    type: z.enum(ACCOUNT_TYPES).optional(),
    currency: z.string().length(3).optional(),
    isCredit: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field required',
  });

// PATCH /api/v1/accounts/:id
router.patch(
  '/:id',
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = paramsSchema.parse(req.params);
    const input = patchAccountSchema.parse(req.body);
    const updated = await updateAccount(id, getAuthUser(req).id, input);
    if (!updated) throw new AccountError(AccountErrorCode.NOT_FOUND);
    res.json(updated);
  }
);

// POST /api/v1/accounts/:id/deactivate
router.post(
  '/:id/deactivate',
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = paramsSchema.parse(req.params);
    const updated = await deactivateAccount(id, getAuthUser(req).id);
    if (!updated) throw new AccountError(AccountErrorCode.NOT_FOUND);
    res.json(updated);
  }
);

// POST /api/v1/accounts/:id/reactivate
router.post(
  '/:id/reactivate',
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = paramsSchema.parse(req.params);
    const updated = await reactivateAccount(id, getAuthUser(req).id);
    if (!updated) throw new AccountError(AccountErrorCode.NOT_FOUND);
    res.json(updated);
  }
);

export default router;
