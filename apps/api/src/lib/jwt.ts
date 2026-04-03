import { randomBytes } from 'crypto';

import jwt from 'jsonwebtoken';

import type { JwtPayload } from '@finance/shared';

import { config } from './config';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function assertObjectPayload(payload: unknown): asserts payload is JwtPayload {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Unexpected JWT payload format');
  }
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload {
  const payload = jwt.verify(token, config.jwtSecret);
  assertObjectPayload(payload);
  return payload;
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>): string {
  // jti (JWT ID) ensures uniqueness even when two tokens are issued in the same second
  return jwt.sign({ ...payload, jti: randomBytes(16).toString('hex') }, config.jwtRefreshSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyRefreshToken(token: string): JwtPayload {
  const payload = jwt.verify(token, config.jwtRefreshSecret);
  assertObjectPayload(payload);
  return payload;
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
}
