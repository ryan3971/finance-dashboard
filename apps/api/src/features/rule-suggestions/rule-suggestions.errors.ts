import { DomainError } from '@/lib/domain-error';

export const RuleSuggestionErrorCode = {
  NOT_FOUND:        'RULE_SUGGESTION_NOT_FOUND',
  FORBIDDEN:        'RULE_SUGGESTION_FORBIDDEN',
  ALREADY_ACTIONED: 'RULE_SUGGESTION_ALREADY_ACTIONED',
} as const;

export type RuleSuggestionErrorCode =
  (typeof RuleSuggestionErrorCode)[keyof typeof RuleSuggestionErrorCode];

const HTTP_STATUS: Record<RuleSuggestionErrorCode, number> = {
  [RuleSuggestionErrorCode.NOT_FOUND]:        404,
  [RuleSuggestionErrorCode.FORBIDDEN]:        403,
  [RuleSuggestionErrorCode.ALREADY_ACTIONED]: 409,
};

const MESSAGES: Record<RuleSuggestionErrorCode, string> = {
  [RuleSuggestionErrorCode.NOT_FOUND]:        'Rule suggestion not found',
  [RuleSuggestionErrorCode.FORBIDDEN]:        'Cannot modify this rule suggestion',
  [RuleSuggestionErrorCode.ALREADY_ACTIONED]: 'Rule suggestion has already been accepted or dismissed',
};

export class RuleSuggestionError extends DomainError {
  readonly code: RuleSuggestionErrorCode;
  readonly httpStatus: number;

  constructor(code: RuleSuggestionErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
