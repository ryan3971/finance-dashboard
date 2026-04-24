import { useQuery } from '@tanstack/react-query';
import { incomeDashboardResponseSchema } from '@finance/shared/schemas/dashboard';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useIncomeDashboard(year: number) {
  return useQuery({
    queryKey: dashboardKeys.income(year),
    queryFn: async () => {
      const { data } = await api.get('/dashboard/income', { params: { year } });
      return incomeDashboardResponseSchema.parse(data);
    },
    staleTime: 1000 * 60 * 5,
  });
}
