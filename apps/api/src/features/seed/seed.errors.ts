import { DomainError } from '@/lib/domain-error';

export const SeedErrorCode = {
  ACCOUNTS_EXIST: 'SEED_ACCOUNTS_EXIST',
} as const;

export type SeedErrorCode = (typeof SeedErrorCode)[keyof typeof SeedErrorCode];

const HTTP_STATUS: Record<SeedErrorCode, number> = {
  [SeedErrorCode.ACCOUNTS_EXIST]: 409,
};

const MESSAGES: Record<SeedErrorCode, string> = {
  [SeedErrorCode.ACCOUNTS_EXIST]:
    'Account already contains data. Reset your account before loading sample data.',
};

export class SeedError extends DomainError {
  readonly code: SeedErrorCode;
  readonly httpStatus: number;

  constructor(code: SeedErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
