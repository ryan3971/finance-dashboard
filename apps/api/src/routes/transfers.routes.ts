import {
  confirmSingleTransfer,
  confirmTransfer,
  dismissTransferFlag,
} from '@/services/transfers/transfer-detection.service';
import type { NextFunction, Request, Response } from 'express';
import { requireAuth } from '@/middleware/auth';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// POST /api/v1/transfers/confirm
router.post(
  '/confirm',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = z
        .object({
          transactionId: z.string().uuid(),
          // pairedTransactionId is optional — omit if only one side is known
          pairedTransactionId: z.string().uuid().optional(),
        })
        .parse(req.body);

      if (input.pairedTransactionId) {
        await confirmTransfer(
          input.transactionId,
          input.pairedTransactionId,
          req.user!.id
        );
      } else {
        await confirmSingleTransfer(input.transactionId, req.user!.id);
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/transfers/dismiss
router.post(
  '/dismiss',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { transactionId } = z
        .object({
          transactionId: z.string().uuid(),
        })
        .parse(req.body);

      await dismissTransferFlag(transactionId, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
