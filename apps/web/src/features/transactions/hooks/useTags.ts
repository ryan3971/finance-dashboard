import { tagKeys, transactionKeys } from '@/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Tag } from '@finance/shared/schemas/transactions';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';

export function useTags() {
  return useQuery<Tag[]>({
    queryKey: tagKeys.all(),
    queryFn: async () => {
      const { data } = await api.get<Tag[]>('/tags');
      return data;
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string }) => {
      const { data } = await api.post<Tag>('/tags', input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all() });
      toast.success(TOAST.TAG_CREATED);
    },
    onError: () => toast.error(TOAST.TAG_CREATE_FAILED),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      await api.delete(`/tags/${tagId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all() });
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      toast.success(TOAST.TAG_DELETED);
    },
    onError: () => toast.error(TOAST.TAG_DELETE_FAILED),
  });
}

export function useAttachTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transactionId,
      tagId,
    }: {
      transactionId: string;
      tagId: string;
    }) => {
      await api.post(`/transactions/${transactionId}/tags`, { tagId });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: transactionKeys.all() }),
  });
}

export function useDetachTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transactionId,
      tagId,
    }: {
      transactionId: string;
      tagId: string;
    }) => {
      await api.delete(`/transactions/${transactionId}/tags/${tagId}`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: transactionKeys.all() }),
  });
}
