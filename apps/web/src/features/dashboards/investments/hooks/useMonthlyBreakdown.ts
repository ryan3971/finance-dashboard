import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { investmentKeys } from '@/lib/queryKeys';
import type { MonthlyBreakdownResponse } from '@finance/shared/types/investments-monthly-breakdown';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useMonthlyBreakdown(year: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: investmentKeys.monthlyBreakdown(year),
    queryFn: async () => {
      const { data } = await api.get<MonthlyBreakdownResponse>(
        '/investments/monthly-breakdown',
        { params: { year } }
      );
      return data;
    },
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}
