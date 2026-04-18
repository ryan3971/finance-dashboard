import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { MONTH_LABELS } from '@/lib/utils';
import { AccountsCard } from './components/AccountsCard';
import { ExpectedVsActualCard } from './components/ExpectedVsActualCard';
import { MonthlyIncomeExpensesCard } from './components/MonthlyIncomeExpensesCard';
import { useSnapshotDashboard } from './hooks/useSnapshotDashboard';

function LiveBadge({
  month,
  year,
}: {
  readonly month: number;
  readonly year: number;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-positive">
      <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
      Live — {MONTH_LABELS[month - 1]} {year}
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
        {data && <LiveBadge month={data.month} year={data.year} />}
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
