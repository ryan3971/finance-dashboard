import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export interface Subcategory {
  id: string;
  name: string;
  isIncome: boolean;
  icon: string | null;
  userId: string | null;
}

export interface Category {
  id: string;
  name: string;
  isIncome: boolean;
  icon: string | null;
  userId: string | null;
  subcategories: Subcategory[];
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<Category[]>('/categories');
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });
}