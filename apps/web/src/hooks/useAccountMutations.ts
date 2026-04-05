import type { AccountType, Institution } from '@finance/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

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
      const { data } = await api.post('/accounts', input);
      return data;
    },
    onSuccess: invalidate,
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
      const { data } = await api.patch(`/accounts/${id}`, input);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useDeactivateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/accounts/${id}/deactivate`);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useReactivateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/accounts/${id}/reactivate`);
      return data;
    },
    onSuccess: invalidate,
  });
}
