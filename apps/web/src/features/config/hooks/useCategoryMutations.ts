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
    onError: () => toast.error(TOAST.SUBCATEGORY_DELETE_FAILED),
  });
}

