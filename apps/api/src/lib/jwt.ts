import { randomBytes } from 'crypto';

import jwt from 'jsonwebtoken';

import type { JwtPayload } from '@finance/shared';

import { config } from './config';
import { REFRESH_TOKEN_MS } from './constants';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Type guard to ensure the JWT payload is an object. The 'jsonwebtoken' library can return a string or an object as the payload depending on how the token was signed, so this guard ensures we have the expected object format before accessing properties on it.
 * @param payload The decoded JWT payload, which can be of type string | object | Buffer according to the 'jsonwebtoken' library typings.
 * @throws Will throw an error if the payload is not an object, which indicates an unexpected token format.
 */
function assertObjectPayload(payload: unknown): asserts payload is JwtPayload {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Unexpected JWT payload format');
  }
}
/**
 * Signs a JWT access token with the provided payload. 
 * The token is signed using the secret from the configuration and has an expiry of 15 minutes.
 * @param payload The payload should include any custom claims needed by the application (e.g. user ID, email) but should not include standard claims like 'iat', 'exp', or 'jti' which are set automatically by the signing function.
 * @returns 
 */
export function signAccessToken(
  payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>
): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Verifies a JWT access token's signature and expiry, then returns its decoded payload.
 *
 * Uses `config.jwtSecret` — the same secret used when the token was signed —
 * so any token issued by a different server or tampered with after signing will be rejected.
 *
 * @param token - The raw JWT string, typically extracted from an `Authorization: Bearer` header.
 * @returns The decoded `JwtPayload` object (contains `sub`, `email`, `iat`, `exp`, etc.).
 * @throws {JsonWebTokenError} If the signature is invalid or the token is malformed.
 * @throws {TokenExpiredError} If the token's `exp` claim is in the past.
 */
export function verifyAccessToken(token: string): JwtPayload {
  const payload = jwt.verify(token, config.jwtSecret);
  assertObjectPayload(payload);
  return payload;
}
/**
 * Signs and returns a new refresh token JWT with a 7-day expiry.
 *
 * A random `jti` (JWT ID) claim is injected into every token to guarantee
 * uniqueness — without it, two tokens issued for the same user in the same
 * second would produce identical strings, breaking token rotation.
 *
 * Uses a separate secret (`config.jwtRefreshSecret`) from access tokens so
 * that a compromised access token secret cannot be used to forge refresh tokens.
 *
 * @param payload - User claims to embed (`sub`, `email`). Standard claims
 *   (`iat`, `exp`, `jti`) are excluded from the parameter — they are set automatically.
 * @returns A signed JWT string.
 */
export function signRefreshToken(
  payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>
): string {
  // jti (JWT ID) ensures uniqueness even when two tokens are issued in the same second
  return jwt.sign(
    { ...payload, jti: randomBytes(16).toString('hex') },
    config.jwtRefreshSecret,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Verifies a JWT refresh token's signature and expiry, then returns its decoded payload.
 *
 * Mirrors `verifyAccessToken` but validates against `config.jwtRefreshSecret`,
 * ensuring refresh tokens cannot be accepted where access tokens are expected and vice versa.
 *
 * @param token - The raw JWT string, typically read from the HttpOnly refresh token cookie.
 * @returns The decoded `JwtPayload` object (contains `sub`, `email`, `iat`, `exp`, `jti`, etc.).
 * @throws {JsonWebTokenError} If the signature is invalid or the token is malformed.
 * @throws {TokenExpiredError} If the token's `exp` claim is in the past.
 */

export function verifyRefreshToken(token: string): JwtPayload {
  const payload = jwt.verify(token, config.jwtRefreshSecret);
  assertObjectPayload(payload);
  return payload;
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_MS);
}
