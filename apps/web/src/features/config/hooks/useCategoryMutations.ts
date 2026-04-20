import { categoryKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Category, Subcategory } from '@finance/shared/types/categories';

export function useRenameCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data } = await api.patch<Category>(`/categories/${id}`, { name });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all() });
      toast.success(TOAST.CATEGORY_UPDATED);
    },
    onError: () => toast.error(TOAST.CATEGORY_UPDATE_FAILED),
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

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all() });
      toast.success(TOAST.CATEGORY_DELETED);
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) {
        toast.error(TOAST.CATEGORY_DELETE_BLOCKED);
      } else {
        toast.error(TOAST.CATEGORY_DELETE_FAILED);
      }
    },
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
    onError: (err: unknown) =>
      toast.error(getApiErrorMessage(err, TOAST.SUBCATEGORY_DELETE_FAILED)),
  });
}

