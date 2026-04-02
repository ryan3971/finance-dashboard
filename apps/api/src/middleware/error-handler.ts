import type {
  NextFunction,
  Request,
  Response,
} from 'express';
import { DomainError } from '@/lib/domain-error';
import { logger } from './logger';
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
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res
      .status(400)
      .json({
        error: 'Validation error',
        details: err.errors,
      });
    return;
  }

  // Handle domain errors — code and httpStatus are set by the error definition,
  // not the service, so no HTTP concepts leak into business logic.
  if (err instanceof DomainError) {
    res.status(err.httpStatus).json({ error: err.message, code: err.code });
    return;
  }

  const appError = err;
  const statusCode = appError.statusCode ?? 500;
  const message = appError.isOperational
    ? appError.message
    : 'Internal server error';

  if (statusCode >= 500) {
    logger.error(
      { err, req: { method: req.method, url: req.url } },
      'Unhandled error'
    );
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' &&
    statusCode >= 500
      ? { stack: err.stack }
      : {}),
  });
}
