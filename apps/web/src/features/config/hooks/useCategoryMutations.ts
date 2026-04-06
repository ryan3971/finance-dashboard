import { categoryKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateSubcategoryInput, Subcategory } from '@finance/shared';

export function useCreateSubcategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSubcategoryInput) => {
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

export function useRenameSubcategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data } = await api.patch<Subcategory>(`/categories/${id}`, { name });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all() });
      toast.success(TOAST.SUBCATEGORY_UPDATED);
    },
    onError: () => toast.error(TOAST.SUBCATEGORY_UPDATE_FAILED),
  });
}

export function useDeleteSubcategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all() });
      toast.success(TOAST.SUBCATEGORY_DELETED);
    },
    onError: () => toast.error(TOAST.SUBCATEGORY_DELETE_FAILED),
  });
}
