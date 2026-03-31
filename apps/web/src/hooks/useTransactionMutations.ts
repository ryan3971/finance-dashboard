import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface PatchTransactionInput {
  categoryId?: string | null;
  subcategoryId?: string | null;
  needWant?: 'Need' | 'Want' | 'NA' | null;
  note?: string | null;
  createRule?: boolean;
}

export function usePatchTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: PatchTransactionInput;
    }) => {
      await api.patch<unknown>(`/transactions/${id}`, input);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useConfirmTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transactionId,
      pairedTransactionId,
    }: {
      transactionId: string;
      pairedTransactionId?: string;
    }) => {
      await api.post('/transfers/confirm', {
        transactionId,
        pairedTransactionId,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useDismissTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      await api.post('/transfers/dismiss', { transactionId });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}
