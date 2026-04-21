import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useRebalancingGroups } from '@/features/transactions/hooks/useRebalancingGroups';
import { RebalancingGroupCard } from './RebalancingGroupCard';

const SKELETON_COUNT = Array.from({ length: 3 }, (_, i) => `skeleton-${i}`);

function GroupSkeleton() {
  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-28 rounded-md" />
          <Skeleton className="h-7 w-14 rounded-md" />
        </div>
      </div>
      <div className="border-t border-border-subtle px-4 py-2.5 flex gap-4">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
      <div className="border-t border-border-subtle px-4 py-3 flex gap-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function RebalancingTab() {
  const { data, isLoading, isError } = useRebalancingGroups();

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {SKELETON_COUNT.map((id) => (
          <GroupSkeleton key={id} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-4">
        <EmptyState
          message="Failed to load rebalancing groups."
          variant="error"
        />
      </div>
    );
  }

  const groups = data?.groups ?? [];

  if (groups.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          message="No rebalancing groups yet."
          hint="Open any transaction's action menu to add it to a new or existing group."
        />
      </div>
    );
  }

  // Sort: flagged-for-review first, then open, then resolved; within each bucket newest first
  const sorted = [...groups].sort((a, b) => {
    if (a.flaggedForReview !== b.flaggedForReview)
      return a.flaggedForReview ? -1 : 1;
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div className="space-y-3 mt-4">
      {sorted.map((group) => (
        <RebalancingGroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}
