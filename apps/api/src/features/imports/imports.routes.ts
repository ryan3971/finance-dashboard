import { type Request, type Response, Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { processImport } from '@/features/imports/pipeline/import.service';
import { getAuthUser, requireAuth } from '@/lib/auth';

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

    const result = await processImport(
      getAuthUser(req).id,
      accountId,
      req.file.originalname,
      req.file.buffer
    );

    res.status(201).json(result);
  }
);

export default router;
