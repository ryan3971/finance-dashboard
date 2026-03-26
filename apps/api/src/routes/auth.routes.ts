import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '@finance/shared';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
} from '../services/auth.service';

const router = Router();

// Refresh token cookie config
const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/v1/auth',
};

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registerSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await registerUser(input);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(201).json({
      accessToken,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await loginUser(input);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);

    res.json({
      accessToken,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incomingToken = req.cookies[REFRESH_COOKIE_NAME];

    if (!incomingToken) {
      res.status(401).json({ error: 'No refresh token provided' });
      return;
    }

    const { accessToken, refreshToken } = await refreshAccessToken(incomingToken);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incomingToken = req.cookies[REFRESH_COOKIE_NAME];

    if (incomingToken) {
      await logoutUser(incomingToken);
    }

    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
