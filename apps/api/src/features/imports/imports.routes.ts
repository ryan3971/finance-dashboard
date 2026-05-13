import { type Request, type Response, Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { processImport } from '@/features/imports/import.service';
import { getAuthUser, requireAuth } from '@/lib/auth';
import type { ImportProgressEvent } from '@finance/shared/types/transactions';

const router = Router();
router.use(requireAuth);

// ─── Internal helpers ─────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/csv',
      'text/plain', // browsers sometimes report CSV files as text/plain
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────

// POST /api/v1/imports/upload
router.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const body = z.object({ accountId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'accountId must be a valid UUID' });
      return;
    }
    const { accountId } = body.data;

    const { id: userId } = getAuthUser(req);
    // Child logger binds requestId (from pino-http) and userId so all log lines
    // emitted during import processing can be correlated to this HTTP request.
    const log = req.log.child({ userId });
    const result = await processImport(
      userId,
      accountId,
      req.file.originalname,
      req.file.buffer,
      log
    );

    res.status(201).json(result);
  }
);

// POST /api/v1/imports/upload/stream
router.post(
  '/upload/stream',
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const body = z.object({ accountId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'accountId must be a valid UUID' });
      return;
    }

    const { accountId } = body.data;
    const { id: userId } = getAuthUser(req);
    const log = req.log.child({ userId });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    function emit(event: ImportProgressEvent) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Intentional try/catch despite Express 5 async propagation: res.flushHeaders()
    // has already been called, so the error middleware cannot write a JSON response.
    // We must emit the error event ourselves before ending the stream.
    try {
      const result = await processImport(
        userId,
        accountId,
        req.file.originalname,
        req.file.buffer,
        log,
        emit
      );
      emit({ stage: 'complete', result });
    } catch (err) {
      emit({
        stage: 'error',
        message: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      res.end();
    }
  }
);

export default router;
