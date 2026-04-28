import { anticipatedBudgetResponseSchema } from '@finance/shared/schemas/anticipated-budget';
import { anticipatedBudgetKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export function useAnticipatedBudget(year: number) {
  return useQuery({
    queryKey: anticipatedBudgetKeys.byYear(year),
    queryFn: async () => {
      const { data } = await api.get<unknown>('/anticipated-budget', { params: { year } });
      return anticipatedBudgetResponseSchema.parse(data);
    },
    staleTime: 1000 * 60 * 5,
  });
}
