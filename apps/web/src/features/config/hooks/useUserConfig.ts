import { userConfigKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { UserConfig } from '@finance/shared/types/user-config';

export function useUserConfig() {
  return useQuery<UserConfig>({
    queryKey: userConfigKeys.all(),
    queryFn: async () => {
      const { data } = await api.get<UserConfig>('/user-config');
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
