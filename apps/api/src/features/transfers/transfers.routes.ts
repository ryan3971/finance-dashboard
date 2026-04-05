import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { getAuthUser, requireAuth } from '@/lib/auth';
import {
  confirmTransfer,
  dismissTransferFlag,
} from '@/pipelines/transfer-detection/transfer-detection.service';

const router = Router();
router.use(requireAuth);

// POST /api/v1/transfers/confirm
router.post('/confirm', async (req: Request, res: Response) => {
  const input = z
    .object({
      transactionId: z.string().uuid(),
      // pairedTransactionId is optional — omit if only one side is known
      pairedTransactionId: z.string().uuid().optional(),
    })
    .parse(req.body);

  await confirmTransfer(
    input.transactionId,
    input.pairedTransactionId,
    getAuthUser(req).id
  );

  res.status(204).send();
});

// POST /api/v1/transfers/dismiss
router.post('/dismiss', async (req: Request, res: Response) => {
  const { transactionId } = z
    .object({
      transactionId: z.string().uuid(),
    })
    .parse(req.body);

  await dismissTransferFlag(transactionId, getAuthUser(req).id);
  res.status(204).send();
});

export default router;
