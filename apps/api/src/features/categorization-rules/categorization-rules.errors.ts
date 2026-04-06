import { DomainError } from '@/lib/domain-error';

export const RuleErrorCode = {
  NOT_FOUND: 'RULE_NOT_FOUND',
  FORBIDDEN: 'RULE_FORBIDDEN',
} as const;

export type RuleErrorCode = (typeof RuleErrorCode)[keyof typeof RuleErrorCode];

const HTTP_STATUS: Record<RuleErrorCode, number> = {
  [RuleErrorCode.NOT_FOUND]: 404,
  [RuleErrorCode.FORBIDDEN]: 403,
};

const MESSAGES: Record<RuleErrorCode, string> = {
  [RuleErrorCode.NOT_FOUND]: 'Rule not found',
  [RuleErrorCode.FORBIDDEN]: 'Cannot modify this rule',
};

export class RuleError extends DomainError {
  readonly code: RuleErrorCode;
  readonly httpStatus: number;

  constructor(code: RuleErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
