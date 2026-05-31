import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Transaction, TransactionFilters } from '@finance/shared/schemas/transactions';
import { transactionKeys } from '@/lib/queryKeys';

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface TransactionsResponse {
  data: Transaction[];
  flaggedTotal: number;
  pagination: PaginationInfo;
}

export function useTransactions({
  page = 1,
  ...filters
}: TransactionFilters & { page?: number } = {}) {
  return useQuery<TransactionsResponse>({
    queryKey: transactionKeys.list({ ...filters, page }),
    queryFn: async () => {
      const { data } = await api.get<TransactionsResponse>('/transactions', {
        params: { ...filters, page },
      });
      return data;
    },
    placeholderData: keepPreviousData,
    // No staleTime — defaults to 0ms so every mount/focus triggers a background
    // refetch. Transactions are user-editable and need to stay fresh, so this is
    // intentional. The opacity-50 dim from isFetching will fire more frequently
    // than on dashboard hooks as a result.
  });
}
