import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import type { JwtPayload } from '@finance/shared';
import { config } from './config';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  // jti (JWT ID) ensures uniqueness even when two tokens are issued in the same second
  return jwt.sign({ ...payload, jti: randomBytes(16).toString('hex') }, config.jwtRefreshSecret, { expiresIn: '7d' });
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as JwtPayload;
}

export function generateRefreshTokenValue(): string {
  return randomBytes(40).toString('hex');
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
}
