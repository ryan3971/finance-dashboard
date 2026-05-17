import { useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { YearSelector } from '@/components/common/YearSelector';
import { cn } from '@/lib/utils';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { investmentTransactionFiltersSchema } from '@finance/shared/schemas/investments';
import { ActivitySummaryCards } from './components/ActivitySummaryCards';
import { ContributionRoomCard } from './components/ContributionRoomCard';
import { InvestmentFilters } from './components/InvestmentFilters';
import { InvestmentSkeleton } from './components/InvestmentSkeleton';
import { InvestmentTransactionsTable } from './components/InvestmentTransactionsTable';
import { useContributionRoom } from './hooks/useContributionRoom';
import { useInvestmentSummary } from './hooks/useInvestmentSummary';
import { useInvestmentTransactions } from './hooks/useInvestmentTransactions';

export function InvestmentsPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());

  const search = useSearch({ from: '/dashboard/investments' });

  // TanStack Router already validates against investmentsSearchSchema; parse once
  // via useMemo so Zod doesn't run on every unrelated context re-render.
  const { accountId, action, symbol, startDate, endDate, page } = search;
  const filters = useMemo(
    () =>
      investmentTransactionFiltersSchema.parse({
        accountId,
        action,
        symbol,
        startDate,
        endDate,
        page: page ?? 1,
      }),
    [accountId, action, symbol, startDate, endDate, page]
  );

  const {
    data: summaryData,
    isPending: summaryPending,
    isFetching: summaryFetching,
    isError: summaryError,
  } = useInvestmentSummary(year);

  const {
    data: roomData,
    isFetching: roomFetching,
  } = useContributionRoom(year);

  const {
    data: txData,
    isPending: txPending,
    isFetching: txFetching,
    isError: txError,
  } = useInvestmentTransactions(filters);

  const showSkeleton = useDelayedPending(summaryPending || txPending);

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-content-primary">Investments</h1>
        <YearSelector year={year} onChange={setYear} />
      </div>

      {/* Skeleton */}
      {showSkeleton && <InvestmentSkeleton />}

      {/* Data — skeleton gate prevents flash; error shown only when no stale data available */}
      {!showSkeleton && (
        <div className="space-y-6">
          {/* Error: only when no stale data can be shown */}
          {(summaryError || txError) && !summaryData && !txData && (
            <EmptyState variant="error" message="Failed to load investment data." />
          )}

          {/* Activity summary cards */}
          {summaryData && (
            <div
              className={cn(
                'transition-opacity duration-200',
                summaryFetching && 'opacity-50'
              )}
            >
              <ActivitySummaryCards data={summaryData} />
            </div>
          )}

          {/* Contribution room — card owns the "no registered accounts" guard */}
          {roomData && (
            <ContributionRoomCard data={roomData} isFetching={roomFetching} />
          )}

          {/* Activity filters */}
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-content-primary">Activity</h2>
            <InvestmentFilters
              filters={{
                accountId: search.accountId,
                action: search.action,
                symbol: search.symbol,
                startDate: search.startDate,
                endDate: search.endDate,
              }}
            />
          </div>

          {/* Transactions table */}
          <InvestmentTransactionsTable
            response={txData}
            isFetching={txFetching}
            page={filters.page}
          />
        </div>
      )}
    </PageLayout>
  );
}
