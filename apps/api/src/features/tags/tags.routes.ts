import { type Request, type Response, Router } from 'express';
import { createTag, deleteTag, listTags } from './tags.service';
import { TagError, TagErrorCode } from './tags.errors';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { createTagSchema } from '@finance/shared/schemas/tags';
import { idParamsSchema } from '@/lib/common-schemas';

const router = Router();
router.use(requireAuth);

// GET /api/v1/tags
router.get('/', async (req: Request, res: Response) => {
  const result = await listTags(getAuthUser(req).id);
  res.json(result);
});

// POST /api/v1/tags
router.post('/', async (req: Request, res: Response) => {
  const input = createTagSchema.parse(req.body);
  const tag = await createTag(getAuthUser(req).id, input);
  res.status(201).json(tag);
});

// DELETE /api/v1/tags/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const deleted = await deleteTag(id, getAuthUser(req).id);
  if (!deleted) throw new TagError(TagErrorCode.NOT_FOUND);
  res.status(204).send();
});

export default router;
