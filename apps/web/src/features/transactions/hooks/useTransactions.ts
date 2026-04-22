import api from '@/lib/api';
import type { NeedWant } from '@finance/shared/constants';
import type { TransactionFilters } from '@finance/shared/schemas/transactions';
import { transactionKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  sourceName: string | null;
  amount: string;
  currency: string;
  needWant: NeedWant | null;
  isTransfer: boolean;
  transferMatchId: string | null;
  transferMatchDescription: string | null;
  transferMatchSourceName: string | null;
  transferMatchAccountName: string | null;
  isIncome: boolean;
  flaggedForReview: boolean;
  categorySource: string | null;
  note: string | null;
  accountId: string;
  accountName: string;
  accountInstitution: string;
  source: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  tags: Tag[];
  rebalancingGroupId: string | null;
  rebalancingRole: 'source' | 'offset' | null;
}

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
