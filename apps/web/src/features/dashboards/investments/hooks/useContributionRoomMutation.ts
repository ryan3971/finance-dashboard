import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { investmentKeys } from '@/lib/queryKeys';
import type { UpsertContributionRoomInput } from '@finance/shared/schemas/investments';

interface UpsertParams {
  accountId: string;
  year: number;
  body: UpsertContributionRoomInput;
}

export function useContributionRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, year, body }: UpsertParams) => {
      await api.put(`/investments/contribution-room/${accountId}/${year}`, body);
    },
    onSuccess: (_, { year }) => {
      void queryClient.invalidateQueries({
        queryKey: investmentKeys.contributionRoom(year),
      });
    },
  });
}
