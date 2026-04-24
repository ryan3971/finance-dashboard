import { useQuery } from '@tanstack/react-query';
import { ytdDashboardResponseSchema } from '@finance/shared/schemas/dashboard';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useYtdDashboard(year: number) {
  return useQuery({
    queryKey: dashboardKeys.ytd(year),
    queryFn: async () => {
      const { data } = await api.get('/dashboard/ytd', { params: { year } });
      return ytdDashboardResponseSchema.parse(data);
    },
    staleTime: 1000 * 60 * 5,
  });
}
