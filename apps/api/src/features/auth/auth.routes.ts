import { loginSchema, registerSchema } from '@finance/shared';
import { REFRESH_TOKEN_MS } from '@/lib/constants';
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from '@/features/auth/auth.service';
import { AuthError, AuthErrorCode } from '@/features/auth/auth.errors';
import type { Request, Response } from 'express';
import { config } from '@/lib/config';
import { Router } from 'express';

const router = Router();

// Refresh token cookie config
const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Helper to read the refresh token from the cookie - ensures it is typed as a string or undefined
function readRefreshToken(req: Request): string | undefined {
  const value: unknown = req.cookies[REFRESH_COOKIE_NAME];
  return typeof value === 'string' ? value : undefined;
}

// Helper to get cookie options for setting the refresh token cookie
function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict' as const,
    maxAge: REFRESH_TOKEN_MS,
    path: REFRESH_COOKIE_PATH,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const { user, accessToken, refreshToken } = await registerUser(input);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  res.status(201).json({ accessToken, user });
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const { user, accessToken, refreshToken } = await loginUser(input);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  res.json({
    accessToken,
    user: { id: user.id, email: user.email },
  });
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const incomingToken = readRefreshToken(req);

  if (!incomingToken) {
    throw new AuthError(AuthErrorCode.MISSING_REFRESH_TOKEN);
  }

  const { accessToken, refreshToken } = await refreshAccessToken(incomingToken);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
  res.json({ accessToken });
});

// POST /api/v1/auth/logout
router.post(
  '/logout',
  async (req: Request, res: Response) => {
    const incomingToken = readRefreshToken(req);

    if (incomingToken) {
      await logoutUser(incomingToken);
    }

    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: REFRESH_COOKIE_PATH,
    });
    res.status(204).send();
  }
);

export default router;
