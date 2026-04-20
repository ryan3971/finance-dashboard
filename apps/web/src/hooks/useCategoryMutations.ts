import { categoryKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Category, Subcategory } from '@finance/shared/types/categories';

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; isIncome: boolean }) => {
      const { data } = await api.post<Category>('/categories', input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all() });
      toast.success(TOAST.CATEGORY_CREATED);
    },
    onError: () => toast.error(TOAST.CATEGORY_CREATE_FAILED),
  });
}

export function useCreateSubcategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; parentId: string }) => {
      const { data } = await api.post<Subcategory>('/categories', input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all() });
      toast.success(TOAST.SUBCATEGORY_CREATED);
    },
    onError: () => toast.error(TOAST.SUBCATEGORY_CREATE_FAILED),
  });
}
