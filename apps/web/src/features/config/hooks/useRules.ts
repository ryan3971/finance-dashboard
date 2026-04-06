import { ruleKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PatchRuleInput, Rule } from '@finance/shared';

export function useRules() {
  return useQuery<Rule[]>({
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
    onError: () => toast.error(TOAST.RULE_UPDATE_FAILED),
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
    onError: () => toast.error(TOAST.RULE_DELETE_FAILED),
  });
}
