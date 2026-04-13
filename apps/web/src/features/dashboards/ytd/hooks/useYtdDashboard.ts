import { useQuery } from '@tanstack/react-query';
import type { YtdDashboardResponse } from '@finance/shared/types/dashboard';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useYtdDashboard(year: number) {
  return useQuery<YtdDashboardResponse>({
    queryKey: dashboardKeys.ytd(year),
    queryFn: async () => {
      const { data } = await api.get<YtdDashboardResponse>('/dashboard/ytd', {
        params: { year },
      });
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
