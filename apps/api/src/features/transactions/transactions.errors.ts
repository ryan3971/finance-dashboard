import { DomainError } from '@/lib/domain-error';

export const TransactionErrorCode = {
  ACCOUNT_NOT_FOUND: 'TRANSACTION_ACCOUNT_NOT_FOUND',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  TAG_NOT_FOUND: 'TRANSACTION_TAG_NOT_FOUND',
} as const;

export type TransactionErrorCode =
  (typeof TransactionErrorCode)[keyof typeof TransactionErrorCode];

const HTTP_STATUS: Record<TransactionErrorCode, number> = {
  [TransactionErrorCode.ACCOUNT_NOT_FOUND]: 422,
  [TransactionErrorCode.TRANSACTION_NOT_FOUND]: 404,
  [TransactionErrorCode.TAG_NOT_FOUND]: 404,
};

const MESSAGES: Record<TransactionErrorCode, string> = {
  [TransactionErrorCode.ACCOUNT_NOT_FOUND]: 'Account not found',
  [TransactionErrorCode.TRANSACTION_NOT_FOUND]: 'Transaction not found',
  [TransactionErrorCode.TAG_NOT_FOUND]: 'Tag not found',
};

export class TransactionError extends DomainError {
  readonly code: TransactionErrorCode;
  readonly httpStatus: number;

  constructor(code: TransactionErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
