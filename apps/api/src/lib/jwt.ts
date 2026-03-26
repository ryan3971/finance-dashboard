import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import type { JwtPayload } from '@finance/shared';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Secrets are read at call time (not module load time) so dotenv has already
// populated process.env before these are used.
function accessSecret(): string {
  return process.env['JWT_SECRET']!;
}
function refreshSecret(): string {
  return process.env['JWT_REFRESH_SECRET']!;
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, accessSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, accessSecret()) as JwtPayload;
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, refreshSecret(), { expiresIn: '7d' });
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, refreshSecret()) as JwtPayload;
}

export function generateRefreshTokenValue(): string {
  return randomBytes(40).toString('hex');
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
}
