import { type AccountType, type Institution } from '@finance/shared/constants';
import { accountKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: Institution;
  currency: 'CAD';
  isCredit: boolean;
  isActive: boolean;
}

const STALE_TIME_MS = 10 * 60 * 1000;

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: accountKeys.all(),
    queryFn: async () => {
      const { data } = await api.get<Account[]>('/accounts');
      return data;
    },
    staleTime: STALE_TIME_MS,
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
    staleTime: STALE_TIME_MS,
  });
}
