import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { investmentKeys } from '@/lib/queryKeys';
import type { RiskBudgetResponse } from '@finance/shared/types/investments';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useRiskBudget(year: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: investmentKeys.riskBudget(year),
    queryFn: async () => {
      const { data } = await api.get<RiskBudgetResponse>(
        '/investments/risk-budget',
        { params: { year } }
      );
      return data;
    },
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}
