// Only subcategory mutations are supported; top-level categories are system-managed

import type { Request, Response } from 'express';
import {
  createSubcategory,
  deleteSubcategory,
  getCategoryTree,
  renameSubcategory,
} from './categories.service';
import {
  createSubcategorySchema,
  patchSubcategorySchema,
} from '@finance/shared';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { idParamsSchema } from '@/lib/common-schemas';
import { Router } from 'express';

const router = Router();
router.use(requireAuth);

// GET /api/v1/categories
// Returns the full category tree: top-level categories with subcategories nested.
// Includes system categories (user_id = null) and the authenticated user's personal categories.
router.get('/', async (req: Request, res: Response) => {
  const tree = await getCategoryTree(getAuthUser(req).id);
  res.json(tree);
});

// POST /api/v1/categories
router.post('/', async (req: Request, res: Response) => {
  const input = createSubcategorySchema.parse(req.body);
  const created = await createSubcategory(getAuthUser(req).id, input);
  res.status(201).json(created);
});

// PATCH /api/v1/categories/:id
router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const { name } = patchSubcategorySchema.parse(req.body);
  const updated = await renameSubcategory(id, getAuthUser(req).id, name);
  res.json(updated);
});

// DELETE /api/v1/categories/:id
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  await deleteSubcategory(id, getAuthUser(req).id);
  res.status(204).send();
});

export default router;
