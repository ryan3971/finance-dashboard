import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Stub — Phase 1B will implement full CRUD
router.get('/', requireAuth, (_req, res) => {
  res.json([]);
});

export default router;
