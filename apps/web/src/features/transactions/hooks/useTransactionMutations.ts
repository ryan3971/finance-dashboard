import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CreateTransactionInput } from '@finance/shared/schemas/transactions';
import type { PatchTransactionInput } from '@finance/shared/types/transactions';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';
import { dashboardKeys, transactionKeys } from '@/lib/queryKeys';

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const { data } = await api.post<{ id: string }>('/transactions', input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      toast.success(TOAST.TRANSACTION_CREATED);
    },
    onError: () => toast.error(TOAST.TRANSACTION_CREATE_FAILED),
  });
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      toast.success(TOAST.TRANSACTION_UPDATED);
    },
    onError: () => toast.error(TOAST.TRANSACTION_UPDATE_FAILED),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete<unknown>(`/transactions/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      toast.success(TOAST.TRANSACTION_DELETED);
    },
    onError: () => toast.error(TOAST.TRANSACTION_DELETE_FAILED),
  });
}

export function useUnmarkTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      await api.post('/transfers/unmark', { transactionId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      toast.success(TOAST.TRANSFER_UNMARKED);
    },
    onError: () => toast.error(TOAST.TRANSFER_UNMARK_FAILED),
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      toast.success(TOAST.TRANSFER_CONFIRMED);
    },
    onError: () => toast.error(TOAST.TRANSFER_CONFIRM_FAILED),
  });
}

export function useDismissTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      await api.post('/transfers/dismiss', { transactionId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      toast.success(TOAST.TRANSFER_DISMISSED);
    },
    onError: () => toast.error(TOAST.TRANSFER_DISMISS_FAILED),
  });
}
