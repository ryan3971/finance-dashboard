import type { AnticipatedBudgetResponse } from '@finance/shared';
import { anticipatedBudgetKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export function useAnticipatedBudget(year: number) {
  return useQuery<AnticipatedBudgetResponse>({
    queryKey: anticipatedBudgetKeys.byYear(year),
    queryFn: async () => {
      const { data } = await api.get<AnticipatedBudgetResponse>(
        '/anticipated-budget',
        { params: { year } }
      );
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
