import type { NeedWant } from '@finance/shared/constants';

// TODO: consider moving this to a more general location if it's used outside of TransactionFilters
export interface FilterState {
  readonly accountId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly month: string; // YYYY-MM; mutually exclusive with startDate/endDate
  readonly categoryId: string;
  readonly subcategoryId: string;
  readonly needWant: NeedWant | '';
  readonly flaggedOnly: boolean;
  readonly isTransfer: boolean;
  readonly tagIds: string[];
}

export const EMPTY_FILTER_STATE: FilterState = {
  accountId: '',
  startDate: '',
  endDate: '',
  month: '',
  categoryId: '',
  subcategoryId: '',
  needWant: '',
  flaggedOnly: false,
  isTransfer: false,
  tagIds: [],
};
