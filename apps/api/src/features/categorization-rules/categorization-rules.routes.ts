import { type Request, type Response, Router } from 'express';
import {
  createRule,
  deleteRule,
  listRules,
  reapplyRule,
  updateRule,
} from './categorization-rules.service';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { idParamsSchema } from '@/lib/common-schemas';
import { createRuleSchema, patchRuleSchema } from '@finance/shared/schemas/rules';

const router = Router();
router.use(requireAuth);

// GET /api/v1/categorization-rules
router.get('/', async (req: Request, res: Response) => {
  const rules = await listRules(getAuthUser(req).id);
  res.json(rules);
});

// POST /api/v1/categorization-rules
router.post('/', async (req: Request, res: Response) => {
  const input = createRuleSchema.parse(req.body);
  const rule = await createRule(getAuthUser(req).id, input);
  res.status(201).json(rule);
});

// PATCH /api/v1/categorization-rules/:id
router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const input = patchRuleSchema.parse(req.body);
  const updated = await updateRule(id, getAuthUser(req).id, input);
  res.json(updated);
});

// POST /api/v1/categorization-rules/:id/reapply
router.post('/:id/reapply', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const applied = await reapplyRule(id, getAuthUser(req).id);
  res.json({ applied });
});

// DELETE /api/v1/categorization-rules/:id
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  await deleteRule(id, getAuthUser(req).id);
  res.status(204).send();
});

export default router;
