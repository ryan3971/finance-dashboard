import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  RebalancingGroup,
  RebalancingRole,
  RebalancingStatus,
} from '@finance/shared/types/rebalancing';
import { rebalancingKeys, dashboardKeys, transactionKeys } from '@/lib/queryKeys';
import api from '@/lib/api';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';

// ─── Input types ──────────────────────────────────────────────────────────────

interface CreateGroupInput {
  label: string;
  initialTransactionId: string;
  role: RebalancingRole;
  myShareOverride?: number;
}

interface UpdateGroupInput {
  label?: string;
  status?: RebalancingStatus;
  myShareOverride?: number | null;
  flaggedForReview?: boolean;
}

interface AddMemberInput {
  transactionId: string;
  role: RebalancingRole;
}

// ─── Invalidation helpers ─────────────────────────────────────────────────────

// Invalidates the groups list and the transaction list (rebalancingGroupId /
// rebalancingRole on individual rows change when a member is added or removed).
function useInvalidateGroups() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: rebalancingKeys.groups() });
    void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
  };
}

// Invalidates the groups list, all dashboard queries, and the transaction list —
// used whenever resolved-group adjustments may have changed (status change,
// member change, myShareOverride change, group deletion).
function useInvalidateGroupsAndDashboards() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: rebalancingKeys.groups() });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
    void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
  };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCreateGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: async (input: CreateGroupInput) => {
      const { data } = await api.post<RebalancingGroup>(
        '/rebalancing/groups',
        input
      );
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success(TOAST.REBALANCING_GROUP_CREATED);
    },
    onError: () => toast.error(TOAST.REBALANCING_GROUP_CREATE_FAILED),
  });
}

export function useUpdateGroup() {
  const invalidate = useInvalidateGroupsAndDashboards();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateGroupInput;
    }) => {
      const { data } = await api.patch<RebalancingGroup>(
        `/rebalancing/groups/${id}`,
        input
      );
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success(TOAST.REBALANCING_GROUP_UPDATED);
    },
    onError: () => toast.error(TOAST.REBALANCING_GROUP_UPDATE_FAILED),
  });
}

export function useDeleteGroup() {
  const invalidate = useInvalidateGroupsAndDashboards();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/rebalancing/groups/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success(TOAST.REBALANCING_GROUP_DELETED);
    },
    onError: () => toast.error(TOAST.REBALANCING_GROUP_DELETE_FAILED),
  });
}

export function useAddGroupMember() {
  const invalidate = useInvalidateGroupsAndDashboards();
  return useMutation({
    mutationFn: async ({
      groupId,
      input,
    }: {
      groupId: string;
      input: AddMemberInput;
    }) => {
      const { data } = await api.post<RebalancingGroup>(
        `/rebalancing/groups/${groupId}/transactions`,
        input
      );
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success(TOAST.REBALANCING_MEMBER_ADDED);
    },
    onError: () => toast.error(TOAST.REBALANCING_MEMBER_ADD_FAILED),
  });
}

export function useRemoveGroupMember() {
  const invalidate = useInvalidateGroupsAndDashboards();
  return useMutation({
    mutationFn: async ({
      groupId,
      transactionId,
    }: {
      groupId: string;
      transactionId: string;
    }) => {
      const { data } = await api.delete<RebalancingGroup>(
        `/rebalancing/groups/${groupId}/transactions/${transactionId}`
      );
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success(TOAST.REBALANCING_MEMBER_REMOVED);
    },
    onError: () => toast.error(TOAST.REBALANCING_MEMBER_REMOVE_FAILED),
  });
}
