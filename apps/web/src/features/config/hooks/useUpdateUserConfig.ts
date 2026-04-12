import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateUserConfigInput } from '@finance/shared/schemas/user-config';
import type { UserConfig } from '@finance/shared/types/user-config';
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
