import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { anticipatedBudgetResponseSchema } from '@finance/shared/schemas/anticipated-budget';
import { anticipatedBudgetKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useAnticipatedBudget(year: number) {
  return useQuery({
    queryKey: anticipatedBudgetKeys.byYear(year),
    queryFn: async () => {
      const { data } = await api.get<unknown>('/anticipated-budget', { params: { year } });
      return anticipatedBudgetResponseSchema.parse(data);
    },
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
