import api from '../lib/api';
import { useQuery } from '@tanstack/react-query';

export interface Account {
  id: string;
  name: string;
  type: string;
  institution: string;
  currency: string;
  isCredit: boolean;
  isActive: boolean;
}

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<Account[]>('/accounts');
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
}
