import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ytdDashboardResponseSchema } from '@finance/shared/schemas/dashboard';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useYtdDashboard(year: number) {
  return useQuery({
    queryKey: dashboardKeys.ytd(year),
    queryFn: async () => {
      const { data } = await api.get<unknown>('/dashboard/ytd', { params: { year } });
      return ytdDashboardResponseSchema.parse(data);
    },
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
