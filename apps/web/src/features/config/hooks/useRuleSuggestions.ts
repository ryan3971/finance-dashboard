import { ruleSuggestionKeys, ruleKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';
import { getApiErrorMessage } from '@/lib/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RuleSuggestion, AcceptSuggestionInput } from '@finance/shared/types/rule-suggestions';
import type { Rule } from '@finance/shared/types/rules';

export function useRuleSuggestions() {
  return useQuery({
    queryKey: ruleSuggestionKeys.all(),
    queryFn: async () => {
      const { data } = await api.get<RuleSuggestion[]>('/rule-suggestions');
      return data;
    },
  });
}

export function useAcceptSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AcceptSuggestionInput }) => {
      const { data } = await api.post<Rule>(`/rule-suggestions/${id}/accept`, input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ruleSuggestionKeys.all() });
      void queryClient.invalidateQueries({ queryKey: ruleKeys.all() });
      toast.success(TOAST.RULE_SUGGESTION_ACCEPTED);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, TOAST.RULE_SUGGESTION_ACCEPT_FAILED)),
  });
}

export function useDismissSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/rule-suggestions/${id}/dismiss`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ruleSuggestionKeys.all() });
      toast.success(TOAST.RULE_SUGGESTION_DISMISSED);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, TOAST.RULE_SUGGESTION_DISMISS_FAILED)),
  });
}
