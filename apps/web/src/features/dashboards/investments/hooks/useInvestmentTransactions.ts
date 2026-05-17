import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { investmentKeys } from '@/lib/queryKeys';
import type { InvestmentTransactionRow } from '@finance/shared/types/investments';
import type { InvestmentTransactionFilters } from '@finance/shared/schemas/investments';

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface InvestmentTransactionsResponse {
  data: InvestmentTransactionRow[];
  pagination: PaginationMeta;
}

const STALE_TIME_MS = 5 * 60 * 1000;

export function useInvestmentTransactions(filters: InvestmentTransactionFilters) {
  return useQuery({
    queryKey: investmentKeys.transactions(filters),
    queryFn: async () => {
      const { data } = await api.get<InvestmentTransactionsResponse>(
        '/investments/transactions',
        { params: filters }
      );
      return data;
    },
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
