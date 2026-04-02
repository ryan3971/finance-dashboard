import {
  getRefreshTokenExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/lib/jwt';
import type { LoginInput, RegisterInput } from '@finance/shared';
import { refreshTokens, users } from '@/db/schema';
import bcrypt from 'bcryptjs';
import { createError } from '@/middleware/error-handler';
import { createHash } from 'crypto';
import { db } from '@/db';
import { eq } from 'drizzle-orm';

const BCRYPT_ROUNDS = 12;

export async function registerUser(input: RegisterInput) {
  // Check for existing user
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    throw createError('Email already registered', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const [user] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      passwordHash,
    })
    .returning({ id: users.id, email: users.email });

  const { accessToken, refreshToken } = await issueTokenPair(
    user.id,
    user.email
  );

  return { user, accessToken, refreshToken };
}

export async function loginUser(input: LoginInput) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (!user) {
    // Constant-time comparison to prevent user enumeration
    await bcrypt.compare(input.password, '$2b$12$invalidhashforuserenum');
    throw createError('Invalid email or password', 401);
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordValid) {
    throw createError('Invalid email or password', 401);
  }

  const { accessToken, refreshToken } = await issueTokenPair(
    user.id,
    user.email
  );

  return {
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(incomingRefreshToken: string) {
  let payload: { sub: string; email: string };
  try {
    payload = verifyRefreshToken(incomingRefreshToken) as {
      sub: string;
      email: string;
    };
  } catch {
    throw createError('Invalid or expired refresh token', 401);
  }

  // Hash the incoming token and look it up in the DB
  const tokenHash = hashRefreshToken(incomingRefreshToken);

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!stored || stored.expiresAt < new Date()) {
    throw createError('Refresh token not found or expired', 401);
  }

  // Rotate: delete the old token, issue a new pair
  await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

  const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(
    payload.sub,
    payload.email
  );

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(incomingRefreshToken: string) {
  const tokenHash = hashRefreshToken(incomingRefreshToken);
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  // Silently succeed even if the token wasn't found
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function issueTokenPair(userId: string, email: string) {
  const accessToken = signAccessToken({
    sub: userId,
    email,
  });
  // The refresh token is a signed JWT stored in the cookie.
  // Its SHA-256 hash is stored in the DB — this enables exact lookup
  // without storing the raw token (which would be a credential).
  const refreshToken = signRefreshToken({
    sub: userId,
    email,
  });
  const tokenHash = hashRefreshToken(refreshToken);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt: getRefreshTokenExpiry(),
  });

  return { accessToken, refreshToken };
}

function hashRefreshToken(token: string): string {
  // SHA-256 hash of the raw token value for storage
  // We use crypto rather than bcrypt here because we need exact lookup,
  // not password-style comparison. The token itself has sufficient entropy.
  return createHash('sha256').update(token).digest('hex');
}
