import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { investmentKeys } from '@/lib/queryKeys';
import { TOAST } from '@/lib/toastMessages';
import type { UpdateRiskLevelInput, UpdateRiskSettingsInput } from '@finance/shared/schemas/investments';

export function useUpdateRiskSettings(year: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateRiskSettingsInput) => {
      await api.patch('/investments/risk-settings', body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.riskBudget(year) });
      toast.success(TOAST.RISK_SETTINGS_SAVED);
    },
    onError: () => toast.error(TOAST.RISK_SETTINGS_SAVE_FAILED),
  });
}

export function useUpdateRiskLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateRiskLevelInput }) => {
      await api.patch(`/investments/transactions/${id}/risk-level`, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investments', 'risk-budget'] });
      void queryClient.invalidateQueries({ queryKey: ['investments', 'transactions'] });
      toast.success(TOAST.RISK_LEVEL_UPDATED);
    },
    onError: () => toast.error(TOAST.RISK_LEVEL_UPDATE_FAILED),
  });
}
