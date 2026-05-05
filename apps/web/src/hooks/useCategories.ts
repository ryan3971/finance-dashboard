import api from '@/lib/api';
import type { Category } from '@finance/shared/types/categories';
import { categoryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export type { Category, Subcategory } from '@finance/shared/types/categories';

const STALE_TIME_MS = 30 * 60 * 1000;

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: categoryKeys.all(),
    queryFn: async () => {
      const { data } = await api.get<Category[]>('/categories');
      return data;
    },
    staleTime: STALE_TIME_MS,
  });
}
