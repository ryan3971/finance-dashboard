import { DomainError } from '@/lib/domain-error';

export const TransferErrorCode = {
  TRANSACTION_NOT_FOUND: 'TRANSFER_TRANSACTION_NOT_FOUND',
} as const;

export type TransferErrorCode =
  (typeof TransferErrorCode)[keyof typeof TransferErrorCode];

const HTTP_STATUS: Record<TransferErrorCode, number> = {
  [TransferErrorCode.TRANSACTION_NOT_FOUND]: 404,
};

const MESSAGES: Record<TransferErrorCode, string> = {
  [TransferErrorCode.TRANSACTION_NOT_FOUND]: 'Transaction not found',
};

export class TransferError extends DomainError {
  readonly code: TransferErrorCode;
  readonly httpStatus: number;

  constructor(code: TransferErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
