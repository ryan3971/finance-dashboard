import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateUserConfigInput, UserConfig } from '@finance/shared';
import { dashboardKeys, userConfigKeys } from '@/lib/queryKeys';
import api from '@/lib/api';

export function useUpdateUserConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserConfigInput) =>
      api.patch<UserConfig>('/user-config', input).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userConfigKeys.all() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
    },
  });
}
