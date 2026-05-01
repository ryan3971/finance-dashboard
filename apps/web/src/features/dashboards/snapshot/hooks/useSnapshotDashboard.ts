import { useQuery } from '@tanstack/react-query';
import { snapshotDashboardResponseSchema } from '@finance/shared/schemas/dashboard';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useSnapshotDashboard(year: number, month: number) {
  return useQuery({
    queryKey: dashboardKeys.snapshot(year, month),
    queryFn: async () => {
      const { data } = await api.get<unknown>('/dashboard/snapshot', {
        params: { year, month },
      });
      return snapshotDashboardResponseSchema.parse(data);
    },
    staleTime: 1000 * 60 * 5,
  });
}
