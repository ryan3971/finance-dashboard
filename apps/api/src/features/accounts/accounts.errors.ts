import { DomainError } from '@/lib/domain-error';

export const AccountErrorCode = {
  NOT_FOUND: 'ACCOUNT_NOT_FOUND',
} as const;

export type AccountErrorCode =
  (typeof AccountErrorCode)[keyof typeof AccountErrorCode];

const HTTP_STATUS: Record<AccountErrorCode, number> = {
  [AccountErrorCode.NOT_FOUND]: 404,
};

const MESSAGES: Record<AccountErrorCode, string> = {
  [AccountErrorCode.NOT_FOUND]: 'Account not found',
};

export class AccountError extends DomainError {
  readonly code: AccountErrorCode;
  readonly httpStatus: number;

  constructor(code: AccountErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
