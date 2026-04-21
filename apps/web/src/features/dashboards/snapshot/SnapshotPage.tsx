import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { AccountsCard } from './components/AccountsCard';
import { ExpectedVsActualCard } from './components/ExpectedVsActualCard';
import { MonthlyIncomeExpensesCard } from './components/MonthlyIncomeExpensesCard';
import { useSnapshotDashboard } from './hooks/useSnapshotDashboard';

function LastUpdatedBadge({ lastUploadedAt }: { readonly lastUploadedAt: string }) {
  const date = new Date(lastUploadedAt);
  const formatted = date.toLocaleDateString('en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return (
    <span className="text-xs font-medium text-content-secondary">
      Updated {formatted}
    </span>
  );
}

function SnapshotSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="p-6 space-y-4 bg-surface rounded-lg border border-border-base">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={`acct-${i}`} className="h-10 w-full" />
          ))}
        </div>
        <div className="p-6 space-y-4 bg-surface rounded-lg border border-border-base">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={`inc-${i}`} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="p-6 space-y-4 bg-surface rounded-lg border border-border-base">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={`exp-${i}`} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SnapshotPage() {
  const { data, isLoading, isError } = useSnapshotDashboard();

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-content-primary">Snapshot</h1>
        {data?.lastUploadedAt && <LastUpdatedBadge lastUploadedAt={data.lastUploadedAt} />}
      </div>

      {isLoading && <SnapshotSkeleton />}

      {isError && (
        <EmptyState
          message="Failed to load snapshot data."
          hint="Try refreshing the page."
          variant="error"
        />
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AccountsCard
              accounts={data.accounts}
              emergencyFund={data.emergencyFund}
            />
            <MonthlyIncomeExpensesCard
              monthlyIncome={data.monthlyIncome}
              monthlyExpenses={data.monthlyExpenses}
            />
          </div>
          <ExpectedVsActualCard
            anticipated={data.anticipated}
            monthlyExpenses={data.monthlyExpenses}
          />
        </div>
      )}
    </PageLayout>
  );
}
