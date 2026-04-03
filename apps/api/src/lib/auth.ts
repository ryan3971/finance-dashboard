import type { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from '@/lib/jwt';

// Extends Express Request with the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

/** Returns the authenticated user. Must only be called in handlers guarded by requireAuth. */
export function getAuthUser(req: Request): { id: string; email: string } {
  if (!req.user) throw new Error('getAuthUser called on unauthenticated request');
  return req.user;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or malformed Authorization header',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}
