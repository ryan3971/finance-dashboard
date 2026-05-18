import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { investmentKeys } from '@/lib/queryKeys';
import { TOAST } from '@/lib/toastMessages';
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
    onSuccess: (data) => {
      const year = new Date(data.date).getFullYear();

      // Invalidate all transaction queries regardless of active filter combination.
      void queryClient.invalidateQueries({
        queryKey: ['investments', 'transactions'],
      });
      // Activity summary totals (deposits affect netDeposits / totalContributions).
      void queryClient.invalidateQueries({
        queryKey: investmentKeys.summary(year),
      });
      // Contribution room (deposits and withdrawals affect available room).
      void queryClient.invalidateQueries({
        queryKey: investmentKeys.contributionRoom(year),
      });

      toast.success(TOAST.INVESTMENT_TRANSACTION_CREATED);
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err.response?.status === 409) {
        toast.error(TOAST.INVESTMENT_TRANSACTION_DUPLICATE);
      } else {
        toast.error(TOAST.INVESTMENT_TRANSACTION_CREATE_FAILED);
      }
    },
  });
}
