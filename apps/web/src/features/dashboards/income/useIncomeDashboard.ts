import { useQuery } from '@tanstack/react-query';
import type { IncomeDashboardResponse } from '@finance/shared';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useIncomeDashboard(year: number) {
  return useQuery<IncomeDashboardResponse>({
    queryKey: dashboardKeys.income(year),
    queryFn: async () => {
      const { data } = await api.get<IncomeDashboardResponse>(
        '/dashboard/income',
        { params: { year } }
      );
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
