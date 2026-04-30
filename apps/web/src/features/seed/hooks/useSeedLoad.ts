import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function useSeedLoad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ message: string }>('/seed/load').then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
