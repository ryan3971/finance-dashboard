import type { Request, Response } from 'express';
import { createTag, deleteTag, listTags } from './tags.service';
import { TagError, TagErrorCode } from './tags.errors';
import { getAuthUser, requireAuth } from '@/lib/auth';
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
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const result = await listTags(getAuthUser(req).id);
  res.json(result);
});

// POST /api/v1/tags
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const input = createTagSchema.parse(req.body);
  const tag = await createTag(getAuthUser(req).id, input);
  res.status(201).json(tag);
});

// DELETE /api/v1/tags/:id
router.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const deleted = await deleteTag(id, getAuthUser(req).id);
    if (!deleted) throw new TagError(TagErrorCode.NOT_FOUND);
    res.status(204).send();
  }
);

export default router;
