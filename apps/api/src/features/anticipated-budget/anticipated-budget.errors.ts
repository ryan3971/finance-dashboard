import { DomainError } from '@/lib/domain-error';

export const AnticipatedBudgetErrorCode = {
  NOT_FOUND: 'ANTICIPATED_BUDGET_NOT_FOUND',
  MONTH_OVERRIDE_NOT_FOUND: 'ANTICIPATED_BUDGET_MONTH_OVERRIDE_NOT_FOUND',
  COPY_TARGET_NOT_EMPTY: 'ANTICIPATED_BUDGET_COPY_TARGET_NOT_EMPTY',
} as const;

type AnticipatedBudgetErrorCode =
  (typeof AnticipatedBudgetErrorCode)[keyof typeof AnticipatedBudgetErrorCode];

const HTTP_STATUS: Record<AnticipatedBudgetErrorCode, number> = {
  [AnticipatedBudgetErrorCode.NOT_FOUND]: 404,
  [AnticipatedBudgetErrorCode.MONTH_OVERRIDE_NOT_FOUND]: 404,
  [AnticipatedBudgetErrorCode.COPY_TARGET_NOT_EMPTY]: 409,
};

const MESSAGES: Record<AnticipatedBudgetErrorCode, string> = {
  [AnticipatedBudgetErrorCode.NOT_FOUND]: 'Anticipated budget entry not found',
  [AnticipatedBudgetErrorCode.MONTH_OVERRIDE_NOT_FOUND]: 'Month override not found',
  [AnticipatedBudgetErrorCode.COPY_TARGET_NOT_EMPTY]:
    'The target year already has entries. Clear them first or use Add Entry.',
};

export class AnticipatedBudgetError extends DomainError {
  readonly code: AnticipatedBudgetErrorCode;
  readonly httpStatus: number;

  constructor(code: AnticipatedBudgetErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}