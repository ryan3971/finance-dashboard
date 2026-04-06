import { type Request, type Response, Router } from 'express';
import { deleteRule, listRules, updateRule } from './categorization-rules.service';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { idParamsSchema } from '@/lib/common-schemas';
import { patchRuleSchema } from '@finance/shared';

const router = Router();
router.use(requireAuth);

// GET /api/v1/categorization-rules
router.get('/', async (req: Request, res: Response) => {
  const rules = await listRules(getAuthUser(req).id);
  res.json(rules);
});

// PATCH /api/v1/categorization-rules/:id
router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const input = patchRuleSchema.parse(req.body);
  const updated = await updateRule(id, getAuthUser(req).id, input);
  res.json(updated);
});

// DELETE /api/v1/categorization-rules/:id
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  await deleteRule(id, getAuthUser(req).id);
  res.status(204).send();
});

export default router;
