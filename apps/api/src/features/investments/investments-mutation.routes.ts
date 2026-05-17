import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAuthUser, requireAuth } from '@/lib/auth';
import { upsertContributionRoomSchema } from '@finance/shared/schemas/investments';
import { upsertContributionRoom } from './investments.service';

const router = Router();
router.use(requireAuth);

const contributionRoomParamsSchema = z.object({
  accountId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
});

// PUT /api/v1/investments/contribution-room/:accountId/:year
router.put(
  '/contribution-room/:accountId/:year',
  async (req: Request, res: Response) => {
    const { accountId, year } = contributionRoomParamsSchema.parse(req.params);
    const body = upsertContributionRoomSchema.parse(req.body);
    await upsertContributionRoom(getAuthUser(req).id, accountId, year, body);
    res.status(204).send();
  }
);

export default router;
