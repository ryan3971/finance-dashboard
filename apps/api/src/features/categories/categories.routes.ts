import type { NextFunction, Request, Response } from 'express';
import { getCategoryTree } from './categories.service';
import { requireAuth } from '@/lib/auth';
import { Router } from 'express';

const router = Router();

// GET /api/v1/categories
// Returns the full category tree: top-level categories with subcategories nested.
// Includes system categories (user_id = null) and the authenticated user's personal categories.
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tree = await getCategoryTree(req.user!.id);
      res.json(tree);
    } catch (err) {
      next(err);
    }
  }
);

export default router;