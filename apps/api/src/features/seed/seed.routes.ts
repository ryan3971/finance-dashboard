import { type Request, type Response, Router } from 'express';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { loadSampleData } from './seed.service';

const router = Router();
router.use(requireAuth);

// POST /api/v1/seed/load
router.post('/load', async (req: Request, res: Response) => {
  await loadSampleData(getAuthUser(req).id);
  res.json({ message: 'Sample data loaded' });
});

export default router;
