import { DomainError } from '@/lib/domain-error';

export const CategoryErrorCode = {
  NOT_FOUND: 'CATEGORY_NOT_FOUND',
  FORBIDDEN: 'CATEGORY_FORBIDDEN',
  INVALID_PARENT: 'CATEGORY_INVALID_PARENT',
  HAS_SUBCATEGORIES: 'CATEGORY_HAS_SUBCATEGORIES',
} as const;

export type CategoryErrorCode = (typeof CategoryErrorCode)[keyof typeof CategoryErrorCode];

const HTTP_STATUS: Record<CategoryErrorCode, number> = {
  [CategoryErrorCode.NOT_FOUND]: 404,
  [CategoryErrorCode.FORBIDDEN]: 403,
  [CategoryErrorCode.INVALID_PARENT]: 400,
  [CategoryErrorCode.HAS_SUBCATEGORIES]: 409,
};

const MESSAGES: Record<CategoryErrorCode, string> = {
  [CategoryErrorCode.NOT_FOUND]: 'Category not found',
  [CategoryErrorCode.FORBIDDEN]: 'You do not own this category',
  [CategoryErrorCode.INVALID_PARENT]: 'Parent must be a top-level category owned by you',
  [CategoryErrorCode.HAS_SUBCATEGORIES]: 'Delete all subcategories before deleting this category',
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
