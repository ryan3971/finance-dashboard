import { DomainError } from '@/lib/domain-error';

export const AnticipatedBudgetErrorCode = {
  NOT_FOUND: 'ANTICIPATED_BUDGET_NOT_FOUND',
  MONTH_OVERRIDE_NOT_FOUND: 'ANTICIPATED_BUDGET_MONTH_OVERRIDE_NOT_FOUND',
} as const;

type AnticipatedBudgetErrorCode =
  (typeof AnticipatedBudgetErrorCode)[keyof typeof AnticipatedBudgetErrorCode];

const HTTP_STATUS: Record<AnticipatedBudgetErrorCode, number> = {
  [AnticipatedBudgetErrorCode.NOT_FOUND]: 404,
  [AnticipatedBudgetErrorCode.MONTH_OVERRIDE_NOT_FOUND]: 404,
};

const MESSAGES: Record<AnticipatedBudgetErrorCode, string> = {
  [AnticipatedBudgetErrorCode.NOT_FOUND]: 'Anticipated budget entry not found',
  [AnticipatedBudgetErrorCode.MONTH_OVERRIDE_NOT_FOUND]: 'Month override not found',
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