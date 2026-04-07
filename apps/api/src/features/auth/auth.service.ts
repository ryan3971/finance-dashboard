import {
  getRefreshTokenExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/lib/jwt';
import type { LoginInput, RegisterInput } from '@finance/shared';
import { refreshTokens, users } from '@/db/schema';
import { AuthError, AuthErrorCode } from '@/features/auth/auth.errors';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { db, type DbTransaction } from '@/db';
import { eq } from 'drizzle-orm';
import { seedUserCategories } from '@/db/seeds/categories';

const BCRYPT_ROUNDS = 12;

export async function registerUser(input: RegisterInput) {
  // Check for existing user
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    throw new AuthError(AuthErrorCode.EMAIL_TAKEN);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // Create user, seed their category tree, and issue tokens atomically.
  // A failed category seed rolls back the user insert — the user is never
  // left with an account but no categories.
  const { user, accessToken, refreshToken } = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash,
      })
      .returning({ id: users.id, email: users.email });

    await seedUserCategories(user.id, tx);

    const tokens = await issueTokenPair(user.id, user.email, tx);

    return { user, ...tokens };
  });

  return {
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
  };
}

export async function loginUser(input: LoginInput) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (!user) {
    // Constant-time comparison to prevent user enumeration
    await bcrypt.compare(input.password, '$2b$12$invalidhashforuserenum');
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS);
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordValid) {
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS);
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
    throw new AuthError(AuthErrorCode.INVALID_REFRESH_TOKEN);
  }

  // Hash the incoming token and look it up in the DB
  const tokenHash = hashRefreshToken(incomingRefreshToken);

  const [stored] = await db
    .select({ id: refreshTokens.id, expiresAt: refreshTokens.expiresAt })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!stored || stored.expiresAt < new Date()) {
    throw new AuthError(AuthErrorCode.REFRESH_TOKEN_NOT_FOUND);
  }

  // Rotate: delete the old token and issue a new pair atomically.
  // If the insert fails, the delete is rolled back — the user's session is preserved.
  const { accessToken, refreshToken: newRefreshToken } = await db.transaction(
    async (tx) => {
      await tx
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, stored.id));
      return issueTokenPair(payload.sub, payload.email, tx);
    }
  );

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(incomingRefreshToken: string) {
  const tokenHash = hashRefreshToken(incomingRefreshToken);
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  // Silently succeed even if the token wasn't found
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function issueTokenPair(
  userId: string,
  email: string,
  tx: typeof db | DbTransaction = db
) {
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

  await tx.insert(refreshTokens).values({
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
