import { DomainError } from '@/lib/domain-error';

export const RebalancingErrorCode = {
  GROUP_NOT_FOUND: 'REBALANCING_GROUP_NOT_FOUND',
  TRANSACTION_NOT_FOUND: 'REBALANCING_TRANSACTION_NOT_FOUND',
  TRANSACTION_ALREADY_IN_GROUP: 'REBALANCING_TRANSACTION_ALREADY_IN_GROUP',
  TRANSACTION_NOT_OWNED: 'REBALANCING_TRANSACTION_NOT_OWNED',
  GROUP_REQUIRES_SOURCE: 'REBALANCING_GROUP_REQUIRES_SOURCE',
} as const;

export type RebalancingErrorCode =
  (typeof RebalancingErrorCode)[keyof typeof RebalancingErrorCode];

const HTTP_STATUS: Record<RebalancingErrorCode, number> = {
  [RebalancingErrorCode.GROUP_NOT_FOUND]: 404,
  [RebalancingErrorCode.TRANSACTION_NOT_FOUND]: 404,
  [RebalancingErrorCode.TRANSACTION_ALREADY_IN_GROUP]: 409,
  [RebalancingErrorCode.TRANSACTION_NOT_OWNED]: 403,
  [RebalancingErrorCode.GROUP_REQUIRES_SOURCE]: 422,
};

const MESSAGES: Record<RebalancingErrorCode, string> = {
  [RebalancingErrorCode.GROUP_NOT_FOUND]: 'Rebalancing group not found',
  [RebalancingErrorCode.TRANSACTION_NOT_FOUND]: 'Transaction not found',
  [RebalancingErrorCode.TRANSACTION_ALREADY_IN_GROUP]:
    'Transaction already belongs to a rebalancing group',
  [RebalancingErrorCode.TRANSACTION_NOT_OWNED]:
    'Transaction does not belong to this user',
  [RebalancingErrorCode.GROUP_REQUIRES_SOURCE]:
    'A resolved group must have at least one source transaction',
};

export class RebalancingError extends DomainError {
  readonly code: RebalancingErrorCode;
  readonly httpStatus: number;

  constructor(code: RebalancingErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
