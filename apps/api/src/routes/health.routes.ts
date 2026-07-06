// toolkit verification 4.2: trivial staleness-trigger comment, reverted after the check
import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
