import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  sourceName: string | null;
  amount: string;
  currency: string;
  categoryName: string | null;
  accountName: string;
  flaggedForReview: boolean;
  needWant: string | null;
}

interface TransactionsResponse {
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useTransactions({ page = 1 }: { page?: number } = {}) {
  return useQuery<TransactionsResponse>({
    queryKey: ['transactions', page],
    queryFn: async () => {
      const { data } = await api.get<TransactionsResponse>('/transactions', {
        params: { page },
      });
      return data;
    },
  });
}