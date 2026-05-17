import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { useRebalancingGroups } from '@/features/transactions/hooks/useRebalancingGroups';
import { RebalancingGroupCard } from './RebalancingGroupCard';
import { RebalancingFilterBar } from './RebalancingFilterBar';
import { RebalancingStatsBar } from './RebalancingStatsBar';
import type { StatusFilter } from '../../types/rebalancingTypes';

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
  const { data, isPending, isError } = useRebalancingGroups();
  const showSkeleton = useDelayedPending(isPending);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [labelSearch, setLabelSearch] = useState('');

  const filtered = useMemo(() => {
    const groups = data?.groups;
    if (!groups?.length) return [];
    const query = labelSearch.trim().toLowerCase();
    return [...groups]
      .sort((a, b) => {
        if (a.flaggedForReview !== b.flaggedForReview)
          return a.flaggedForReview ? -1 : 1;
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      })
      .filter((g) => {
        if (statusFilter === 'flagged' && !g.flaggedForReview) return false;
        if (statusFilter === 'open' && g.status !== 'open') return false;
        if (statusFilter === 'resolved' && g.status !== 'resolved') return false;
        if (query && !g.label.toLowerCase().includes(query)) return false;
        return true;
      });
  }, [data?.groups, statusFilter, labelSearch]);

  if (showSkeleton) {
    return (
      <div className="space-y-3 mt-4">
        {SKELETON_COUNT.map((id) => (
          <GroupSkeleton key={id} />
        ))}
      </div>
    );
  }

  if (isPending) return null;

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

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <RebalancingStatsBar groups={groups} />
        <RebalancingFilterBar
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          labelSearch={labelSearch}
          onLabelSearch={setLabelSearch}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message="No groups match your filters."
          hint="Try a different status tab or clear the search."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((group) => (
            <RebalancingGroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
