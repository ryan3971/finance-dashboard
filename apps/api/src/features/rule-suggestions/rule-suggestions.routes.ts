import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { idParamsSchema } from '@/lib/common-schemas';
import {
  acceptSuggestion,
  dismissSuggestion,
  listPendingSuggestions,
} from './rule-suggestions.service';

const router = Router();
router.use(requireAuth);

const acceptBodySchema = z.object({
  keyword:       z.string().min(1).optional(),
  categoryId:    z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  needWant:      z.enum(['Need', 'Want']).nullable().optional(),
  priority:      z.number().int().optional(),
  matchType:     z.enum(['substring', 'wildcard']).optional(),
});

// GET /api/v1/rule-suggestions
router.get('/', async (req: Request, res: Response) => {
  const suggestions = await listPendingSuggestions(getAuthUser(req).id);
  res.json(
    suggestions.map((s) => ({
      ...s,
      confidence: Number(s.confidence),
      createdAt:  s.createdAt.toISOString(),
    }))
  );
});

// POST /api/v1/rule-suggestions/:id/accept
router.post('/:id/accept', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const input = acceptBodySchema.parse(req.body ?? {});
  const rule = await acceptSuggestion(id, getAuthUser(req).id, input);
  res.status(201).json(rule);
});

// POST /api/v1/rule-suggestions/:id/dismiss
router.post('/:id/dismiss', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  await dismissSuggestion(id, getAuthUser(req).id);
  res.status(204).send();
});

export default router;
