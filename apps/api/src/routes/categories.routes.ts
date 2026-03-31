import { eq, isNull, or } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { categories } from '@/db/schema';
import { db } from '@/db';
import { requireAuth } from '@/middleware/auth';
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
      const userId = req.user!.id;

      const allCategories = await db
        .select()
        .from(categories)
        .where(or(isNull(categories.userId), eq(categories.userId, userId)))
        .orderBy(categories.name);

      const topLevel = allCategories.filter((c) => c.parentId === null);
      const subcategories = allCategories.filter((c) => c.parentId !== null);

      const tree = topLevel.map((parent) => ({
        id: parent.id,
        name: parent.name,
        isIncome: parent.isIncome,
        icon: parent.icon,
        userId: parent.userId,
        subcategories: subcategories
          .filter((sub) => sub.parentId === parent.id)
          .map((sub) => ({
            id: sub.id,
            name: sub.name,
            isIncome: sub.isIncome,
            icon: sub.icon,
            userId: sub.userId,
          })),
      }));

      res.json(tree);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
