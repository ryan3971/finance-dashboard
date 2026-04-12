import { type AccountType, type Institution } from '@finance/shared/constants';
import { accountKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: Institution;
  currency: string;
  isCredit: boolean;
  isActive: boolean;
}

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: accountKeys.all(),
    queryFn: async () => {
      const { data } = await api.get<Account[]>('/accounts');
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useAllAccounts() {
  return useQuery<Account[]>({
    queryKey: accountKeys.allWithInactive(),
    queryFn: async () => {
      const { data } = await api.get<Account[]>('/accounts', {
        params: { includeInactive: true },
      });
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
}
