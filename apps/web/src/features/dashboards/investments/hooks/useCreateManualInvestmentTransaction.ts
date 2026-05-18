import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { TOAST } from '@/lib/toastMessages';
import { getApiErrorMessage } from '@/lib/errors';
import type { AxiosError } from 'axios';
import type { CreateManualInvestmentTransactionInput } from '@finance/shared/schemas/investments';
import type { InvestmentTransactionRow } from '@finance/shared/types/investments';

export function useCreateManualInvestmentTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateManualInvestmentTransactionInput) => {
      const { data } = await api.post<InvestmentTransactionRow>(
        '/investments/transactions',
        input
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate all transaction queries regardless of active filter combination.
      void queryClient.invalidateQueries({
        queryKey: ['investments', 'transactions'],
      });
      // Invalidate all summary and contribution-room queries regardless of which
      // year is currently displayed. A transaction dated outside the active year
      // (e.g. 2024 entry while viewing 2025) would leave summary cards stale if
      // we only invalidated the year derived from data.date.
      void queryClient.invalidateQueries({
        queryKey: ['investments', 'summary'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['investments', 'contribution-room'],
      });

      toast.success(TOAST.INVESTMENT_TRANSACTION_CREATED);
    },
    onError: (err: AxiosError) => {
      if (err.response?.status === 409) {
        toast.error(TOAST.INVESTMENT_TRANSACTION_DUPLICATE);
      } else {
        toast.error(getApiErrorMessage(err, TOAST.INVESTMENT_TRANSACTION_CREATE_FAILED));
      }
    },
  });
}
