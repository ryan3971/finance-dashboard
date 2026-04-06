import { AccountError, AccountErrorCode } from './accounts.errors';
import {
  deactivateAccount,
  reactivateAccount,
  updateAccount,
} from './accounts.services';
import { accountFormSchema } from '@finance/shared';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { idParamsSchema } from '@/lib/common-schemas';
import { type Request, type Response, Router } from 'express';

const router = Router();
router.use(requireAuth);

const patchAccountSchema = accountFormSchema
  .omit({ isCredit: true })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field required',
  });


// PATCH /api/v1/accounts/:id
router.patch(
  '/:id',
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    const input = patchAccountSchema.parse(req.body);
    const updated = await updateAccount(id, getAuthUser(req).id, input);
    // null covers both not-found and not-owned; collapse to 404 to avoid leaking existence
    if (!updated) throw new AccountError(AccountErrorCode.NOT_FOUND);
    res.json(updated);
  }
);

// POST /api/v1/accounts/:id/deactivate
router.post(
  '/:id/deactivate',
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    const updated = await deactivateAccount(id, getAuthUser(req).id);
    // null covers both not-found and not-owned; collapse to 404 to avoid leaking existence
    if (!updated) throw new AccountError(AccountErrorCode.NOT_FOUND);
    res.json(updated);
  }
);

// POST /api/v1/accounts/:id/reactivate
router.post(
  '/:id/reactivate',
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = idParamsSchema.parse(req.params);
    const updated = await reactivateAccount(id, getAuthUser(req).id);
    // null covers both not-found and not-owned; collapse to 404 to avoid leaking existence
    if (!updated) throw new AccountError(AccountErrorCode.NOT_FOUND);
    res.json(updated);
  }
);

export default router;
