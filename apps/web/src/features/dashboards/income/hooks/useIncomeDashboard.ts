import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { incomeDashboardResponseSchema } from '@finance/shared/schemas/dashboard';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useIncomeDashboard(year: number) {
  return useQuery({
    queryKey: dashboardKeys.income(year),
    queryFn: async () => {
      const { data } = await api.get<unknown>('/dashboard/income', { params: { year } });
      return incomeDashboardResponseSchema.parse(data);
    },
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
