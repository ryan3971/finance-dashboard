import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Tag } from './useTransactions';

export function useTags() {
  return useQuery<Tag[]>({
    queryKey: ['tags'],
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      await api.delete(`/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useAttachTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ transactionId, tagId }: { transactionId: string; tagId: string }) => {
      await api.post(`/transactions/${transactionId}/tags`, { tagId });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useDetachTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ transactionId, tagId }: { transactionId: string; tagId: string }) => {
      await api.delete(`/transactions/${transactionId}/tags/${tagId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}