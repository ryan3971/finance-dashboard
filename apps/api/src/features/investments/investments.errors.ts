import { DomainError } from '@/lib/domain-error';

export const InvestmentErrorCode = {
  INVESTMENT_ACCOUNT_NOT_FOUND: 'INVESTMENT_ACCOUNT_NOT_FOUND',
  INVESTMENT_ACCOUNT_FORBIDDEN: 'INVESTMENT_ACCOUNT_FORBIDDEN',
  INVESTMENT_TRANSACTION_NOT_FOUND: 'INVESTMENT_TRANSACTION_NOT_FOUND',
  INVALID_ACCOUNT_TYPE_FOR_ROOM: 'INVALID_ACCOUNT_TYPE_FOR_ROOM',
  INVALID_ACCOUNT_TYPE_FOR_TRANSACTION: 'INVALID_ACCOUNT_TYPE_FOR_TRANSACTION',
  DUPLICATE_INVESTMENT_TRANSACTION: 'DUPLICATE_INVESTMENT_TRANSACTION',
} as const;

export type InvestmentErrorCode =
  (typeof InvestmentErrorCode)[keyof typeof InvestmentErrorCode];

const HTTP_STATUS: Record<InvestmentErrorCode, number> = {
  [InvestmentErrorCode.INVESTMENT_ACCOUNT_NOT_FOUND]: 404,
  [InvestmentErrorCode.INVESTMENT_ACCOUNT_FORBIDDEN]: 403,
  [InvestmentErrorCode.INVESTMENT_TRANSACTION_NOT_FOUND]: 404,
  [InvestmentErrorCode.INVALID_ACCOUNT_TYPE_FOR_ROOM]: 400,
  [InvestmentErrorCode.INVALID_ACCOUNT_TYPE_FOR_TRANSACTION]: 400,
  [InvestmentErrorCode.DUPLICATE_INVESTMENT_TRANSACTION]: 409,
};

const MESSAGES: Record<InvestmentErrorCode, string> = {
  [InvestmentErrorCode.INVESTMENT_ACCOUNT_NOT_FOUND]: 'Investment account not found',
  [InvestmentErrorCode.INVESTMENT_ACCOUNT_FORBIDDEN]: 'Access to this account is not allowed',
  [InvestmentErrorCode.INVESTMENT_TRANSACTION_NOT_FOUND]: 'Investment transaction not found',
  [InvestmentErrorCode.INVALID_ACCOUNT_TYPE_FOR_ROOM]:
    'Account type does not support contribution room tracking',
  [InvestmentErrorCode.INVALID_ACCOUNT_TYPE_FOR_TRANSACTION]:
    'Account type does not support investment transactions',
  [InvestmentErrorCode.DUPLICATE_INVESTMENT_TRANSACTION]:
    'A transaction with identical fields already exists',
};

export class InvestmentError extends DomainError {
  readonly code: InvestmentErrorCode;
  readonly httpStatus: number;

  constructor(code: InvestmentErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
