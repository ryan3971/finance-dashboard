import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { investmentKeys } from '@/lib/queryKeys';
import type { ContributionRoomResponse } from '@finance/shared/types/investments';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useContributionRoom(year: number) {
  return useQuery({
    queryKey: investmentKeys.contributionRoom(year),
    queryFn: async () => {
      const { data } = await api.get<ContributionRoomResponse>(
        '/investments/contribution-room',
        { params: { year } }
      );
      return data;
    },
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
