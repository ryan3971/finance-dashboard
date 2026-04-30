import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function useResetAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ message: string }>('/user-config/reset').then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
