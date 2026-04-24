import { useQuery } from '@tanstack/react-query';
import { expenseCategoriesResponseSchema } from '@finance/shared/schemas/dashboard';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useExpenseCategories(year: number) {
  return useQuery({
    queryKey: dashboardKeys.expensesCategories(year),
    queryFn: async () => {
      const { data } = await api.get('/dashboard/expenses/categories', { params: { year } });
      return expenseCategoriesResponseSchema.parse(data);
    },
    staleTime: 1000 * 60 * 5,
  });
}
