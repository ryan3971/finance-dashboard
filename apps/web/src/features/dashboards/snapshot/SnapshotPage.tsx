import { useNavigate, useSearch } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { AccountsCard } from './components/AccountsCard';
import { IncomeFlowCard } from './components/IncomeFlowCard';
import { SpendingSummaryCard } from './components/SpendingSummaryCard';
import { useSnapshotDashboard } from './hooks/useSnapshotDashboard';

// ── Month navigator ───────────────────────────────────────────────────────────

function MonthNavigator({
  year,
  month,
}: {
  readonly year: number;
  readonly month: number;
}) {
  const navigate = useNavigate();
  const now = new Date();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  const label = new Date(year, month - 1, 1).toLocaleDateString('en-CA', {
    month: 'long',
    year: 'numeric',
  });

  function handlePrev() {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    void navigate({
      to: '/dashboard/snapshot',
      search: { year: prevYear, month: prevMonth },
    });
  }

  function handleNext() {
    if (isCurrentMonth) return;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    void navigate({
      to: '/dashboard/snapshot',
      search: { year: nextYear, month: nextMonth },
    });
  }

  function handleToday() {
    void navigate({ to: '/dashboard/snapshot', search: {} });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrev}
        className="p-1.5 rounded hover:bg-surface-muted text-content-secondary hover:text-content-primary transition-colors"
        aria-label="Previous month"
      >
        ‹
      </button>
      <span className="px-1 text-sm font-medium text-content-primary min-w-[130px] text-center">
        {label}
      </span>
      <button
        onClick={handleNext}
        disabled={isCurrentMonth}
        className={cn(
          'p-1.5 rounded text-content-secondary transition-colors',
          isCurrentMonth
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-surface-muted hover:text-content-primary'
        )}
        aria-label="Next month"
      >
        ›
      </button>
      {!isCurrentMonth && (
        <button
          onClick={handleToday}
          className="text-xs text-info underline hover:no-underline ml-1"
        >
          Today
        </button>
      )}
    </div>
  );
}

// ── Last updated badge ────────────────────────────────────────────────────────

function LastUpdatedBadge({
  lastUploadedAt,
}: {
  readonly lastUploadedAt: string;
}) {
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SnapshotSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="p-6 space-y-4 bg-surface rounded-lg border border-border-base">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={`inc-${i}`} className="h-8 w-full" />
          ))}
        </div>
        <div className="p-6 space-y-4 bg-surface rounded-lg border border-border-base">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={`acct-${i}`} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="p-6 space-y-4 bg-surface rounded-lg border border-border-base">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={`spend-${i}`} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
          <LastUpdatedBadge lastUploadedAt={data.lastUploadedAt} />
        )}
      </div>

      {showSkeleton && <SnapshotSkeleton />}

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
            spendingIncome={data.monthlyIncome.spendingIncome}
          />
        </div>
      )}
    </PageLayout>
  );
}
