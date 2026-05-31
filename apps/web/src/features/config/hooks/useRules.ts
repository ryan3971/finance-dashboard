import { ruleKeys, transactionKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';
import { getApiErrorMessage } from '@/lib/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRuleInput, PatchRuleInput } from '@finance/shared/schemas/rules';
import type { Rule } from '@finance/shared/types/rules';

export function useRules() {
  return useQuery({
    queryKey: ruleKeys.all(),
    queryFn: async () => {
      const { data } = await api.get<Rule[]>('/categorization-rules');
      return data;
    },
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PatchRuleInput }) => {
      const { data } = await api.patch<Rule>(`/categorization-rules/${id}`, input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ruleKeys.all() });
      toast.success(TOAST.RULE_UPDATED);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, TOAST.RULE_UPDATE_FAILED)),
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categorization-rules/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ruleKeys.all() });
      toast.success(TOAST.RULE_DELETED);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, TOAST.RULE_DELETE_FAILED)),
  });
}

export function useReapplyRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{ applied: number }>(`/categorization-rules/${id}/reapply`);
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
      const n = data.applied;
      toast.success(
        n === 0
          ? 'No matching transactions found'
          : `Rule applied to ${n} transaction${n === 1 ? '' : 's'}`
      );
    },
    onError: (err) => toast.error(getApiErrorMessage(err, TOAST.RULE_REAPPLY_FAILED)),
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      const { data } = await api.post<Rule>('/categorization-rules', input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ruleKeys.all() });
      toast.success(TOAST.RULE_CREATED);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, TOAST.RULE_CREATE_FAILED)),
  });
}
