import type { Request, Response } from 'express';
import {
  createCategory,
  deleteCategory,
  getCategoryTree,
  renameCategory,
  repairSystemCategoryLinks,
} from './categories.service';
import { createCategorySchema, patchCategorySchema } from '@finance/shared/schemas/categories';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { idParamsSchema } from '@/lib/common-schemas';
import { Router } from 'express';

const router = Router();
router.use(requireAuth);

// GET /api/v1/categories
// Returns the authenticated user's full category tree: top-level categories with subcategories nested.
router.get('/', async (req: Request, res: Response) => {
  const tree = await getCategoryTree(getAuthUser(req).id);
  res.json(tree);
});

// POST /api/v1/categories
// Creates a top-level category ({ name, isIncome }) or a subcategory ({ name, parentId }).
router.post('/', async (req: Request, res: Response) => {
  const input = createCategorySchema.parse(req.body);
  const created = await createCategory(getAuthUser(req).id, input);
  res.status(201).json(created);
});

// PATCH /api/v1/categories/:id
router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const { name } = patchCategorySchema.parse(req.body);
  const updated = await renameCategory(id, getAuthUser(req).id, name);
  res.json(updated);
});

// DELETE /api/v1/categories/:id
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  await deleteCategory(id, getAuthUser(req).id);
  res.status(204).send();
});

// POST /api/v1/categories/repair
// One-time repair: remaps any transaction categoryId/subcategoryId values that
// point at system category UUIDs (userId = null) to the equivalent user-owned
// category UUIDs. This corrects data written before the loadRules bug was fixed.
// Safe to call multiple times — returns { updated: 0 } once the data is clean.
router.post('/repair', async (req: Request, res: Response) => {
  const result = await repairSystemCategoryLinks(getAuthUser(req).id);
  res.json(result);
});

export default router;
