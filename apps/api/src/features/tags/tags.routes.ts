import type { NextFunction, Request, Response } from 'express';
import { createTag, deleteTag, listTags } from './tags.service';
import { requireAuth } from '@/lib/auth';
import { Router } from 'express';
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
      const result = await listTags(req.user!.id);
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
      const tag = await createTag(req.user!.id, input);
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
      const found = await deleteTag(req.params.id, req.user!.id);
      if (!found) {
        res.status(404).json({ error: 'Tag not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;