import { useQuery } from '@tanstack/react-query';
import type { ExpenseDashboardResponse } from '@finance/shared';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useExpensesDashboard(year: number) {
  return useQuery<ExpenseDashboardResponse>({
    queryKey: dashboardKeys.expenses(year),
    queryFn: async () => {
      const { data } = await api.get<ExpenseDashboardResponse>(
        '/dashboard/expenses',
        { params: { year } }
      );
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
