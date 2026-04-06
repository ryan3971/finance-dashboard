import { DomainError } from '@/lib/domain-error';

export const CategoryErrorCode = {
  NOT_FOUND: 'CATEGORY_NOT_FOUND',
  FORBIDDEN: 'CATEGORY_FORBIDDEN',
  INVALID_PARENT: 'CATEGORY_INVALID_PARENT',
} as const;

export type CategoryErrorCode = (typeof CategoryErrorCode)[keyof typeof CategoryErrorCode];

const HTTP_STATUS: Record<CategoryErrorCode, number> = {
  [CategoryErrorCode.NOT_FOUND]: 404,
  [CategoryErrorCode.FORBIDDEN]: 403,
  [CategoryErrorCode.INVALID_PARENT]: 400,
};

const MESSAGES: Record<CategoryErrorCode, string> = {
  [CategoryErrorCode.NOT_FOUND]: 'Category not found',
  [CategoryErrorCode.FORBIDDEN]: 'Cannot modify a system category',
  [CategoryErrorCode.INVALID_PARENT]: 'Parent must be a top-level category',
};

export class CategoryError extends DomainError {
  readonly code: CategoryErrorCode;
  readonly httpStatus: number;

  constructor(code: CategoryErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
