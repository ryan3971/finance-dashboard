import type { AccountType, Institution } from '@finance/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Account } from '@/hooks/useAccounts';
import { accountKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';

interface CreateAccountInput {
  name: string;
  type: AccountType;
  institution: Institution;
  currency: string;
}

interface UpdateAccountInput {
  name?: string;
  institution?: Institution;
  type?: AccountType;
  currency?: string;
  isCredit?: boolean;
}

function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: accountKeys.all() });
    void queryClient.invalidateQueries({
      queryKey: accountKeys.allWithInactive(),
    });
  };
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      const { data } = await api.post<Account>('/accounts', input);
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success(TOAST.ACCOUNT_CREATED);
    },
    onError: () => toast.error(TOAST.ACCOUNT_CREATE_FAILED),
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateAccountInput;
    }) => {
      const { data } = await api.patch<Account>(`/accounts/${id}`, input);
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success(TOAST.ACCOUNT_UPDATED);
    },
    onError: () => toast.error(TOAST.ACCOUNT_UPDATE_FAILED),
  });
}

export function useDeactivateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Account>(`/accounts/${id}/deactivate`);
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success(TOAST.ACCOUNT_DEACTIVATED);
    },
    onError: () => toast.error(TOAST.ACCOUNT_DEACTIVATE_FAILED),
  });
}

export function useReactivateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Account>(`/accounts/${id}/reactivate`);
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success(TOAST.ACCOUNT_REACTIVATED);
    },
    onError: () => toast.error(TOAST.ACCOUNT_REACTIVATE_FAILED),
  });
}
