import { DomainError } from '@/lib/domain-error';

export const InvestmentErrorCode = {
  INVESTMENT_ACCOUNT_NOT_FOUND: 'INVESTMENT_ACCOUNT_NOT_FOUND',
  INVESTMENT_ACCOUNT_FORBIDDEN: 'INVESTMENT_ACCOUNT_FORBIDDEN',
  CONTRIBUTION_RECORD_NOT_FOUND: 'CONTRIBUTION_RECORD_NOT_FOUND',
  INVALID_ACCOUNT_TYPE_FOR_ROOM: 'INVALID_ACCOUNT_TYPE_FOR_ROOM',
} as const;

export type InvestmentErrorCode =
  (typeof InvestmentErrorCode)[keyof typeof InvestmentErrorCode];

const HTTP_STATUS: Record<InvestmentErrorCode, number> = {
  [InvestmentErrorCode.INVESTMENT_ACCOUNT_NOT_FOUND]: 404,
  [InvestmentErrorCode.INVESTMENT_ACCOUNT_FORBIDDEN]: 403,
  [InvestmentErrorCode.CONTRIBUTION_RECORD_NOT_FOUND]: 404,
  [InvestmentErrorCode.INVALID_ACCOUNT_TYPE_FOR_ROOM]: 400,
};

const MESSAGES: Record<InvestmentErrorCode, string> = {
  [InvestmentErrorCode.INVESTMENT_ACCOUNT_NOT_FOUND]: 'Investment account not found',
  [InvestmentErrorCode.INVESTMENT_ACCOUNT_FORBIDDEN]: 'Access to this account is not allowed',
  [InvestmentErrorCode.CONTRIBUTION_RECORD_NOT_FOUND]: 'Contribution record not found',
  [InvestmentErrorCode.INVALID_ACCOUNT_TYPE_FOR_ROOM]:
    'Account type does not support contribution room tracking',
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
