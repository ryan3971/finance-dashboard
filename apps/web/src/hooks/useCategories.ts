import api from '@/lib/api';
import type { Category } from '@finance/shared';
import { categoryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export type { Category, Subcategory } from '@finance/shared';

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: categoryKeys.all(),
    queryFn: async () => {
      const { data } = await api.get<Category[]>('/categories');
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });
}
