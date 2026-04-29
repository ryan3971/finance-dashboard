import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '@/lib/domain-error';
import { config } from '@/lib/config';
import { logger } from './logger';
import multer from 'multer';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError | ZodError | DomainError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const id = req.id;
  const requestId = typeof id === 'string' || typeof id === 'number' ? String(id) : '';

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors,
      requestId,
    });
    return;
  }

  // Handle multer errors — file size limit and fileFilter rejections are client
  // errors (400), not server faults.
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File exceeds the 10 MB limit'
        : `Upload error: ${err.message}`;
    res.status(400).json({ error: message, requestId });
    return;
  }
  if (err instanceof Error && err.message.startsWith('Unsupported file type')) {
    res.status(400).json({ error: err.message, requestId });
    return;
  }

  // Handle domain errors — code and httpStatus are set by the error definition,
  // not the service, so no HTTP concepts leak into business logic.
  if (err instanceof DomainError) {
    res.status(err.httpStatus).json({ error: err.message, code: err.code, requestId });
    return;
  }

  const appError = err;
  const statusCode = appError.statusCode ?? 500;
  const message = appError.isOperational
    ? appError.message
    : 'Internal server error';

  if (statusCode >= 500) {
    logger.error(
      { err, req: { method: req.method, url: req.url }, requestId },
      'Unhandled error'
    );
  }

  res.status(statusCode).json({
    error: message,
    requestId,
    ...(config.nodeEnv === 'development' && statusCode >= 500
      ? { stack: err.stack }
      : {}),
  });
}
