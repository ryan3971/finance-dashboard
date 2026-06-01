import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/Button';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { useRebalancingGroups } from '@/features/transactions/hooks/useRebalancingGroups';
import { useDetectRefunds } from '@/features/transactions/hooks/useRebalancingMutations';
import { RebalancingGroupCard } from './RebalancingGroupCard';
import { RebalancingFilterBar } from './RebalancingFilterBar';
import { RebalancingStatsBar } from './RebalancingStatsBar';
import { RefundGroupCard } from './RefundGroupCard';
import { cn } from '@/lib/utils';
import type { StatusFilter } from '../../types/rebalancingTypes';

type TabType = 'rebalancing' | 'refunds';

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

function TypeTabBar({
  activeTab,
  onTabChange,
  refundCount,
}: {
  readonly activeTab: TabType;
  readonly onTabChange: (tab: TabType) => void;
  readonly refundCount: number;
}) {
  return (
    <div className="flex gap-1 border-b border-border-subtle mb-4">
      {(['rebalancing', 'refunds'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
            activeTab === tab
              ? 'border-content-primary text-content-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary'
          )}
        >
          {tab === 'refunds' && refundCount > 0 ? (
            <span className="flex items-center gap-1.5">
              Refunds
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-warning text-white text-xs font-semibold">
                {refundCount}
              </span>
            </span>
          ) : (
            tab.charAt(0).toUpperCase() + tab.slice(1)
          )}
        </button>
      ))}
    </div>
  );
}

export function RebalancingTab() {
  const { data, isPending, isError } = useRebalancingGroups();
  const showSkeleton = useDelayedPending(isPending);
  const [activeTab, setActiveTab] = useState<TabType>('rebalancing');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [labelSearch, setLabelSearch] = useState('');
  const detectRefunds = useDetectRefunds();

  const rebalancingGroups = useMemo(
    () => (data?.groups ?? []).filter((g) => g.type === 'rebalancing'),
    [data?.groups]
  );

  const refundGroups = useMemo(
    () => (data?.groups ?? []).filter((g) => g.type === 'refund'),
    [data?.groups]
  );

  const pendingRefundCount = useMemo(
    () => refundGroups.filter((g) => g.status === 'open').length,
    [refundGroups]
  );

  const filteredRebalancing = useMemo(() => {
    const query = labelSearch.trim().toLowerCase();
    return [...rebalancingGroups]
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
  }, [rebalancingGroups, statusFilter, labelSearch]);

  const sortedRefunds = useMemo(
    () =>
      [...refundGroups].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [refundGroups]
  );

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

  const allGroups = data?.groups ?? [];

  if (allGroups.length === 0 && activeTab === 'rebalancing') {
    return (
      <div className="mt-4">
        <TypeTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          refundCount={pendingRefundCount}
        />
        <EmptyState
          message="No rebalancing groups yet."
          hint="Open any transaction's action menu to add it to a new or existing group."
        />
      </div>
    );
  }

  return (
    <div className="mt-4">
      <TypeTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        refundCount={pendingRefundCount}
      />

      {activeTab === 'rebalancing' && (
        <div className="space-y-3">
          {rebalancingGroups.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <RebalancingStatsBar groups={rebalancingGroups} />
              <RebalancingFilterBar
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                labelSearch={labelSearch}
                onLabelSearch={setLabelSearch}
              />
            </div>
          )}

          {rebalancingGroups.length === 0 ? (
            <EmptyState
              message="No rebalancing groups yet."
              hint="Open any transaction's action menu to add it to a new or existing group."
            />
          ) : filteredRebalancing.length === 0 ? (
            <EmptyState
              message="No groups match your filters."
              hint="Try a different status tab or clear the search."
            />
          ) : (
            <div className="space-y-3">
              {filteredRebalancing.map((group) => (
                <RebalancingGroupCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'refunds' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              disabled={detectRefunds.isPending}
              onClick={() => detectRefunds.mutate()}
            >
              {detectRefunds.isPending ? 'Scanning…' : 'Detect Refunds'}
            </Button>
          </div>

          {sortedRefunds.length === 0 ? (
            <EmptyState
              message="No refund pairs detected."
              hint='Click "Detect Refunds" to scan for same-account charge and credit pairs.'
            />
          ) : (
            <div className="space-y-3">
              {sortedRefunds.map((group) => (
                <RefundGroupCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
