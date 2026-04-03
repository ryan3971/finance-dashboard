import type { Request, Response } from 'express';
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
  async (req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tree = await getCategoryTree(req.user!.id);
    res.json(tree);
  }
);

export default router;
