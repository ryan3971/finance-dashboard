import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { investmentKeys } from '@/lib/queryKeys';
import type { InvestmentSummaryResponse } from '@finance/shared/types/investments';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useInvestmentSummary(year: number) {
  return useQuery({
    queryKey: investmentKeys.summary(year),
    queryFn: async () => {
      const { data } = await api.get<InvestmentSummaryResponse>(
        '/investments/summary',
        { params: { year } }
      );
      return data;
    },
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
