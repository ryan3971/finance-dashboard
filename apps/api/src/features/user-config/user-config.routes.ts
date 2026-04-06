import { type Request, type Response, Router } from 'express';
import { getUserConfig, updateUserConfig } from './user-config.service';
import { getAuthUser, requireAuth } from '@/lib/auth';

const router = Router();
router.use(requireAuth);

// GET /api/v1/user-config
router.get('/', async (req: Request, res: Response) => {
  const config = await getUserConfig(getAuthUser(req).id);
  res.json(config);
});

// PATCH /api/v1/user-config
router.patch('/', async (req: Request, res: Response) => {
  const config = await updateUserConfig(getAuthUser(req).id, {});
  res.json(config);
});

export default router;
