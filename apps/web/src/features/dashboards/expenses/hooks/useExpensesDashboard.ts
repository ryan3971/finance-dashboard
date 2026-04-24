import { useQuery } from '@tanstack/react-query';
import { expenseDashboardResponseSchema } from '@finance/shared/schemas/dashboard';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useExpensesDashboard(year: number) {
  return useQuery({
    queryKey: dashboardKeys.expenses(year),
    queryFn: async () => {
      const { data } = await api.get('/dashboard/expenses', { params: { year } });
      return expenseDashboardResponseSchema.parse(data);
    },
    staleTime: 1000 * 60 * 5,
  });
}
