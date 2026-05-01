import {
  getRefreshTokenExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/lib/jwt';
import type { LoginInput, RegisterInput } from '@finance/shared/schemas/auth';
import type { JwtPayload } from '@finance/shared/types/auth';
import { refreshTokens, users } from '@/db/schema';
import { AuthError, AuthErrorCode } from '@/features/auth/auth.errors';
import bcrypt from 'bcryptjs';
import { config } from '@/lib/config';
import { createHash } from 'crypto';
import { db, type DbTransaction } from '@/db';
import { eq } from 'drizzle-orm';
import { seedUserCategories } from '@/db/seeders/user-categories';
import { seedUserRules } from '@/db/seeders/user-rules';
import { assertDefined } from '@/lib/assert';

// Pre-computed at module load using the configured bcrypt rounds so that the
// dummy comparison in loginUser() takes the same time as a real one — preventing
// user enumeration via timing. hashSync is intentional: it runs exactly once at
// startup, not in the request hot path.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', config.bcryptRounds);

/**
 * Registers a new user by:
 *  1) checking for existing email
 *  2) hashing the password with bcrypt
 *  3) creating the user in the database
 *  4) seeding their category tree with default categories and rules
 *  5) issuing an access and refresh token pair for immediate authentication.
 * All database operations are performed within a transaction to ensure atomicity — if any step fails, the entire operation is rolled back, leaving no partial data (e.g. a user without seeded categories or issued tokens).
 * @param input The registration input containing the user's email and password
 * @returns
 */
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

  // Hash the password with bcrypt. The salt is generated automatically and included in the hash string.
  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);

  // Create user, seed their category tree, and issue tokens atomically.
  // A failed category seed rolls back the user insert — the user is never
  // left with an account but no categories.
  const { user, accessToken, refreshToken } = await db.transaction(
    async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          passwordHash,
        })
        .returning({ id: users.id, email: users.email });

      assertDefined(user, 'User insert returned no rows');

      await seedUserCategories(user.id, tx);
      await seedUserRules(user.id, tx);

      const tokens = await issueTokenPair(user.id, user.email, tx);

      return { user, ...tokens };
    }
  );

  return {
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
  };
}
/**
 * Logs in a user by
 *  1) verifying their credentials
 *  2) issuing a new access and refresh token.
 * Implements constant-time password comparison to prevent user enumeration.
 */
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
    // Constant-time comparison against a pre-computed hash (using the same
    // bcrypt rounds as real hashes) so the response time is indistinguishable
    // from a failed password check, preventing user enumeration via timing.
    await bcrypt.compare(input.password, DUMMY_HASH);
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
/**
 * Exchanges a valid refresh token for a new access/refresh token pair (token rotation).
 *
 * Two-stage validation is intentional:
 *  1. **JWT signature check** — verifies the token was issued by this server and hasn't been
 *     tampered with. Rejects immediately if the signature is invalid or the token is expired.
 *  2. **DB lookup by hash** — confirms the token is still active (i.e. hasn't already been
 *     rotated or explicitly revoked). The raw token is never stored; only its SHA-256 hash is.
 *
 * On success, the old token is deleted and a new pair is issued inside a single transaction.
 * If the insert fails the delete is rolled back, so the user's session is never silently destroyed.
 *
 * @param incomingRefreshToken - The refresh token string sent by the client (typically from an
 *   HttpOnly cookie).
 * @returns A new `{ accessToken, refreshToken }` pair. The client must store the new refresh
 *   token and discard the old one.
 * @throws {AuthError} `INVALID_REFRESH_TOKEN` — JWT signature/expiry check failed.
 * @throws {AuthError} `REFRESH_TOKEN_NOT_FOUND` — token not in DB or past its `expiresAt` date.
 */
export async function refreshAccessToken(incomingRefreshToken: string) {
  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(incomingRefreshToken);
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
      await tx.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
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

/**
 *
 * @param userId The user ID to associate with the tokens
 * @param email The user's email, included in the token payload for convenience (e.g. to avoid a DB lookup when refreshing the access token)
 * @param tx An optional transaction object. If provided, the token pair will be issued within this transaction; otherwise, a new transaction will be created for the DB operations. This allows the caller to control transactional boundaries, ensuring atomicity when issuing tokens alongside other operations (e.g. user creation).
 * @returns
 */
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
/**
 * Storing it as a SHA-256 hash means that if the database is compromised,
 * attackers cannot impersonate users with stolen tokens.
 * @param token The raw refresh token string
 * @returns
 */
function hashRefreshToken(token: string): string {
  // SHA-256 hash of the raw token value for storage
  // We use crypto rather than bcrypt here because we need exact lookup,
  // not password-style comparison. The token itself has sufficient entropy.
  return createHash('sha256').update(token).digest('hex');
}
