import type {
  AnticipatedBudgetEntry,
  CreateAnticipatedBudgetInput,
  UpdateAnticipatedBudgetInput,
  UpsertMonthOverrideInput,
} from '@finance/shared';
import { TOAST } from '@/lib/toastMessages';
import { anticipatedBudgetKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateEntry(year: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAnticipatedBudgetInput) => {
      const { data } = await api.post<AnticipatedBudgetEntry>(
        '/anticipated-budget',
        input
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: anticipatedBudgetKeys.byYear(year),
      });
      toast.success(TOAST.BUDGET_ENTRY_CREATED);
    },
    onError: () => toast.error(TOAST.BUDGET_ENTRY_CREATE_FAILED),
  });
}

export function useUpdateEntry(year: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateAnticipatedBudgetInput;
    }) => {
      const { data } = await api.patch<AnticipatedBudgetEntry>(
        `/anticipated-budget/${id}`,
        patch
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: anticipatedBudgetKeys.byYear(year),
      });
      toast.success(TOAST.BUDGET_ENTRY_UPDATED);
    },
    onError: () => toast.error(TOAST.BUDGET_ENTRY_UPDATE_FAILED),
  });
}

export function useDeleteEntry(year: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/anticipated-budget/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: anticipatedBudgetKeys.byYear(year),
      });
      toast.success(TOAST.BUDGET_ENTRY_DELETED);
    },
    onError: () => toast.error(TOAST.BUDGET_ENTRY_DELETE_FAILED),
  });
}

export function useUpsertMonthOverride(year: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      month,
      input,
    }: {
      entryId: string;
      month: number;
      input: UpsertMonthOverrideInput;
    }) => {
      await api.put(`/anticipated-budget/${entryId}/months/${month}`, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: anticipatedBudgetKeys.byYear(year),
      });
      toast.success(TOAST.BUDGET_MONTH_OVERRIDE_SAVED);
    },
    onError: () => toast.error(TOAST.BUDGET_MONTH_OVERRIDE_SAVE_FAILED),
  });
}

export function useDeleteMonthOverride(year: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      month,
    }: {
      entryId: string;
      month: number;
    }) => {
      await api.delete(`/anticipated-budget/${entryId}/months/${month}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: anticipatedBudgetKeys.byYear(year),
      });
      toast.success(TOAST.BUDGET_MONTH_OVERRIDE_REMOVED);
    },
    onError: () => toast.error(TOAST.BUDGET_MONTH_OVERRIDE_REMOVE_FAILED),
  });
}
