// TODO: consider moving this to a more general location if it's used outside of TransactionFilters
export interface FilterState {
  readonly accountId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly categoryId: string;
  readonly subcategoryId: string;
  readonly flaggedOnly: boolean;
}

export const EMPTY_FILTER_STATE: FilterState = {
  accountId: '',
  startDate: '',
  endDate: '',
  categoryId: '',
  subcategoryId: '',
  flaggedOnly: false,
};
