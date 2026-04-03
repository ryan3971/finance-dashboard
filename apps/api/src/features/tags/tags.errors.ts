import { DomainError } from '@/lib/domain-error';

export const TagErrorCode = {
  NOT_FOUND: 'TAG_NOT_FOUND',
  NAME_TAKEN: 'TAG_NAME_TAKEN',
} as const;

export type TagErrorCode = (typeof TagErrorCode)[keyof typeof TagErrorCode];

const HTTP_STATUS: Record<TagErrorCode, number> = {
  [TagErrorCode.NOT_FOUND]: 404,
  [TagErrorCode.NAME_TAKEN]: 409,
};

const MESSAGES: Record<TagErrorCode, string> = {
  [TagErrorCode.NOT_FOUND]: 'Tag not found',
  [TagErrorCode.NAME_TAKEN]: 'A tag with that name already exists',
};

export class TagError extends DomainError {
  readonly code: TagErrorCode;
  readonly httpStatus: number;

  constructor(code: TagErrorCode) {
    super(MESSAGES[code]);
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}
