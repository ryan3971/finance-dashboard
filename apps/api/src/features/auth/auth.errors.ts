import { DomainError } from '@/lib/domain-error';

export const AuthErrorCode = {
  EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN: 'AUTH_INVALID_REFRESH_TOKEN',
  MISSING_REFRESH_TOKEN: 'AUTH_MISSING_REFRESH_TOKEN',
  REFRESH_TOKEN_NOT_FOUND: 'AUTH_REFRESH_TOKEN_NOT_FOUND',
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

// HTTP status and message are co-located with the error definition.
// The service throws AuthError(code) — it never mentions status codes.
const HTTP_STATUS: Record<AuthErrorCode, number> = {
  [AuthErrorCode.EMAIL_TAKEN]: 409,
  [AuthErrorCode.INVALID_CREDENTIALS]: 401,
  [AuthErrorCode.INVALID_REFRESH_TOKEN]: 401,
  [AuthErrorCode.MISSING_REFRESH_TOKEN]: 401,
  [AuthErrorCode.REFRESH_TOKEN_NOT_FOUND]: 401,
};

const MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrorCode.EMAIL_TAKEN]: 'Email already registered',
  [AuthErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password',
  [AuthErrorCode.INVALID_REFRESH_TOKEN]: 'Invalid or expired refresh token',
  [AuthErrorCode.MISSING_REFRESH_TOKEN]: 'No refresh token provided',
  [AuthErrorCode.REFRESH_TOKEN_NOT_FOUND]: 'Refresh token not found or expired',
};

export class AuthError extends DomainError {
  readonly code: AuthErrorCode;
  readonly httpStatus: number;

  constructor(code: AuthErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
