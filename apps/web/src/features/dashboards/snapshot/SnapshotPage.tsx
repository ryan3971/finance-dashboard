import { useSearch } from '@tanstack/react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { AccountsCard } from './components/AccountsCard';
import { IncomeFlowCard } from './components/IncomeFlowCard';
import { LastUpdatedBadge, MonthNavigator } from './components/SnapshotPageHeader';
import { SnapshotSkeleton } from './components/SnapshotSkeleton';
import { SpendingSummaryCard } from './components/SpendingSummaryCard';
import { useSnapshotDashboard } from './hooks/useSnapshotDashboard';

export function SnapshotPage() {
  const { year: yearParam, month: monthParam } = useSearch({
    from: '/dashboard/snapshot',
  });

  const now = new Date();
  const year = yearParam ?? now.getFullYear();
  const month = monthParam ?? now.getMonth() + 1;

  const { data, isPending, isError } = useSnapshotDashboard(year, month);
  const showSkeleton = useDelayedPending(isPending);

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-content-primary">
            Snapshot
          </h1>
          <MonthNavigator year={year} month={month} />
        </div>
        {data?.lastUploadedAt && (
          <LastUpdatedBadge lastUploadedAt={new Date(data.lastUploadedAt)} />
        )}
      </div>

      {showSkeleton && <SnapshotSkeleton />}

      {isError && !data && (
        <EmptyState
          message="Failed to load snapshot data."
          hint="Try refreshing the page."
          variant="error"
        />
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <IncomeFlowCard
              monthlyIncome={data.monthlyIncome}
              anticipated={data.anticipated}
            />
            <AccountsCard
              accounts={data.accounts}
              emergencyFund={data.emergencyFund}
            />
          </div>
          <SpendingSummaryCard
            anticipated={data.anticipated}
            monthlyExpenses={data.monthlyExpenses}
            monthlyIncome={data.monthlyIncome}
          />
        </div>
      )}
    </PageLayout>
  );
}
