import { useQuery } from '@tanstack/react-query';
import { snapshotDashboardResponseSchema } from '@finance/shared/schemas/dashboard';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useSnapshotDashboard() {
  return useQuery({
    queryKey: dashboardKeys.snapshot(),
    queryFn: async () => {
      const { data } = await api.get<unknown>('/dashboard/snapshot');
      return snapshotDashboardResponseSchema.parse(data);
    },
    staleTime: 1000 * 60 * 5,
  });
}
