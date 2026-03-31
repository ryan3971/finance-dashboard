import { and, eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { db } from '@/db';
import { requireAuth } from '@/middleware/auth';
import { Router } from 'express';
import { tags } from '@/db/schema';
import { z } from 'zod';

const router = Router();

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex code e.g. #FF5733')
    .optional(),
});

// GET /api/v1/tags
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db
        .select()
        .from(tags)
        .where(eq(tags.userId, req.user!.id))
        .orderBy(tags.name);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/tags
router.post(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createTagSchema.parse(req.body);

      const [tag] = await db
        .insert(tags)
        .values({ ...input, userId: req.user!.id })
        .returning();

      res.status(201).json(tag);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/tags/:id
router.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [tag] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.id, req.params.id), eq(tags.userId, req.user!.id)))
        .limit(1);

      if (!tag) {
        res.status(404).json({ error: 'Tag not found' });
        return;
      }

      // transactionTags rows deleted automatically via ON DELETE CASCADE
      await db.delete(tags).where(eq(tags.id, req.params.id));

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
