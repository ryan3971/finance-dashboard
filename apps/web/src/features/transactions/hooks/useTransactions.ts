import api from '@/lib/api';
import type { NeedWant } from '@finance/shared';
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
  isIncome: boolean;
  flaggedForReview: boolean;
  categorySource: string | null;
  note: string | null;
  accountId: string;
  accountName: string;
  accountInstitution: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  tags: Tag[];
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
  accountId,
  startDate,
  endDate,
  categoryId,
  flagged,
  page = 1,
}: {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  flagged?: boolean;
  page?: number;
} = {}) {
  return useQuery<TransactionsResponse>({
    queryKey: transactionKeys.list({ accountId, startDate, endDate, categoryId, flagged, page }),
    queryFn: async () => {
      const { data } = await api.get<TransactionsResponse>('/transactions', {
        params: { accountId, startDate, endDate, categoryId, flagged, page },
      });
      return data;
    },
  });
}
