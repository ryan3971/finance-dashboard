import { type Request, type Response, Router } from 'express';
import { getUserConfig, resetAccount, updateUserConfig } from './user-config.service';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { updateUserConfigSchema } from '@finance/shared/schemas/user-config';

const router = Router();
router.use(requireAuth);

// GET /api/v1/user-config
router.get('/', async (req: Request, res: Response) => {
  const config = await getUserConfig(getAuthUser(req).id);
  res.json(config);
});

// PATCH /api/v1/user-config
router.patch('/', async (req: Request, res: Response) => {
  const input = updateUserConfigSchema.parse(req.body);
  const config = await updateUserConfig(getAuthUser(req).id, input);
  res.json(config);
});

// POST /api/v1/user-config/reset
router.post('/reset', async (req: Request, res: Response) => {
  await resetAccount(getAuthUser(req).id);
  res.json({ message: 'Account reset' });
});

export default router;
