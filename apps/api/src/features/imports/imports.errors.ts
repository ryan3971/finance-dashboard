import { DomainError } from '@/lib/domain-error';

export const ImportErrorCode = {
  ACCOUNT_NOT_FOUND: 'IMPORT_ACCOUNT_NOT_FOUND',
  NO_ADAPTER: 'IMPORT_NO_ADAPTER',
} as const;

export type ImportErrorCode = (typeof ImportErrorCode)[keyof typeof ImportErrorCode];

const HTTP_STATUS: Record<ImportErrorCode, number> = {
  [ImportErrorCode.ACCOUNT_NOT_FOUND]: 404,
  [ImportErrorCode.NO_ADAPTER]: 422,
};

const MESSAGES: Record<ImportErrorCode, string> = {
  [ImportErrorCode.ACCOUNT_NOT_FOUND]: 'Account not found',
  [ImportErrorCode.NO_ADAPTER]: 'No adapter found for this institution or file format',
};

export class ImportError extends DomainError {
  readonly code: ImportErrorCode;
  readonly httpStatus: number;

  constructor(code: ImportErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
