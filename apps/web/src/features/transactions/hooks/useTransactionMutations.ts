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
      const { data } = await api.patch<{ retroactivelyApplied: number }>(`/transactions/${id}`, input);
      return data;
    },
    onSuccess: (data, { input }) => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      const n = data.retroactivelyApplied;
      const message =
        input.createRule && n > 0
          ? `Transaction updated, rule applied to ${n} other transaction${n === 1 ? '' : 's'}`
          : TOAST.TRANSACTION_UPDATED;
      toast.success(message);
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

export function useDetectAllTransfers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ matched: number }>('/transfers/detect-all');
      return data;
    },
    onSuccess: ({ matched }) => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      const message =
        matched === 0
          ? 'No new transfer pairs found'
          : `Found ${matched} transfer pair${matched === 1 ? '' : 's'}`;
      toast.success(message);
    },
    onError: () => toast.error(TOAST.TRANSFER_DETECT_ALL_FAILED),
  });
}

export function useApplyRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ applied: number; skipped: number }>(
        '/transactions/apply-rules'
      );
      return data;
    },
    onSuccess: ({ applied }) => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      const message =
        applied === 0
          ? 'No matching transactions found'
          : `Applied rules to ${applied} transaction${applied === 1 ? '' : 's'}`;
      toast.success(message);
    },
    onError: () => toast.error(TOAST.RULES_APPLY_FAILED),
  });
}
