import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { processImport } from '@/services/imports/import.service';
import { requireAuth } from '@/middleware/auth';
import { Router } from 'express';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.xlsx')
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// POST /api/v1/imports/upload
router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const { accountId } = req.body as {
        accountId?: string;
      };
      if (!accountId) {
        res.status(400).json({ error: 'accountId is required' });
        return;
      }

      const fileType = req.file.originalname.endsWith('.xlsx') ? 'xlsx' : 'csv';

      const result = await processImport(
        req.user!.id,
        accountId,
        req.file.originalname,
        req.file.buffer,
        fileType
      );

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
