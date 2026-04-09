import { DomainError } from '@/lib/domain-error';

export const TransferErrorCode = {
  TRANSACTION_NOT_FOUND: 'TRANSFER_TRANSACTION_NOT_FOUND',
  PAIRED_TRANSACTION_NOT_FOUND: 'TRANSFER_PAIRED_TRANSACTION_NOT_FOUND',
  ALREADY_CONFIRMED: 'TRANSFER_ALREADY_CONFIRMED',
} as const;

export type TransferErrorCode =
  (typeof TransferErrorCode)[keyof typeof TransferErrorCode];

const HTTP_STATUS: Record<TransferErrorCode, number> = {
  [TransferErrorCode.TRANSACTION_NOT_FOUND]: 404,
  [TransferErrorCode.PAIRED_TRANSACTION_NOT_FOUND]: 404,
  [TransferErrorCode.ALREADY_CONFIRMED]: 409,
};

const MESSAGES: Record<TransferErrorCode, string> = {
  [TransferErrorCode.TRANSACTION_NOT_FOUND]: 'Transaction not found',
  [TransferErrorCode.PAIRED_TRANSACTION_NOT_FOUND]:
    'Paired transaction not found',
  [TransferErrorCode.ALREADY_CONFIRMED]:
    'Transaction is already confirmed as a transfer',
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
