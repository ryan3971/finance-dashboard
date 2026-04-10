import { useQuery } from '@tanstack/react-query';
import type { ExpenseCategoriesResponse } from '@finance/shared';
import { dashboardKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useExpenseCategories(year: number) {
  return useQuery<ExpenseCategoriesResponse>({
    queryKey: dashboardKeys.expensesCategories(year),
    queryFn: async () => {
      const { data } = await api.get<ExpenseCategoriesResponse>(
        '/dashboard/expenses/categories',
        { params: { year } }
      );
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
