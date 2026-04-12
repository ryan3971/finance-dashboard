import { useQuery } from '@tanstack/react-query';
import type { SnapshotDashboardResponse } from '@finance/shared';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useSnapshotDashboard() {
  return useQuery<SnapshotDashboardResponse>({
    queryKey: dashboardKeys.snapshot(),
    queryFn: async () => {
      const { data } = await api.get<SnapshotDashboardResponse>('/dashboard/snapshot');
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
