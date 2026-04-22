import api from '@/lib/api';
import type { Transaction, TransactionFilters } from '@finance/shared/schemas/transactions';
import { transactionKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface TransactionsResponse {
  data: Transaction[];
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
  });
}
