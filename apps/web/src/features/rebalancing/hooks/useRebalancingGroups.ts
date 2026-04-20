import { useQuery } from '@tanstack/react-query';
import type { RebalancingGroupsResponse } from '@finance/shared/types/rebalancing';
import { rebalancingKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useRebalancingGroups() {
  return useQuery<RebalancingGroupsResponse>({
    queryKey: rebalancingKeys.groups(),
    queryFn: async () => {
      const { data } = await api.get<RebalancingGroupsResponse>(
        '/rebalancing/groups'
      );
      return data;
    },
    staleTime: 1000 * 60 * 2,
  });
}
