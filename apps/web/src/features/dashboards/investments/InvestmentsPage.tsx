import { useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { YearSelector } from '@/components/common/YearSelector';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { investmentTransactionFiltersSchema } from '@finance/shared/schemas/investments';
import { ActivityStatsBar } from './components/ActivityStatsBar';
import { ContributionRoomCard } from './components/ContributionRoomCard';
import { InvestmentFilters } from './components/InvestmentFilters';
import { InvestmentSkeleton } from './components/InvestmentSkeleton';
import { InvestmentTransactionsTable } from './components/InvestmentTransactionsTable';
import { ManualInvestmentTransactionPanel } from './components/ManualInvestmentTransactionPanel';
import { MonthlyBreakdownTable } from './components/MonthlyBreakdownTable';
import { YtdProgressSection } from './components/YtdProgressSection';
import { useContributionRoom } from './hooks/useContributionRoom';
import { useInvestmentTransactions } from './hooks/useInvestmentTransactions';
import { useMonthlyBreakdown } from './hooks/useMonthlyBreakdown';

export function InvestmentsPage() {
  const { currentYear, currentMonth } = useMemo(() => {
    const now = new Date();
    return { currentYear: now.getFullYear(), currentMonth: now.getMonth() + 1 };
  }, []);

  const [year, setYear] = useState(() => currentYear);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const search = useSearch({ from: '/dashboard/investments' });
  const navigate = useNavigate({ from: '/dashboard/investments' });

  const activeTab = search.tab ?? 'dashboard';

  function handleTabChange(value: string) {
    if (value === 'dashboard' || value === 'activity') {
      void navigate({ search: (prev) => ({ ...prev, tab: value }) });
    }
  }

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
    data: roomData,
    isPending: roomPending,
    isFetching: roomFetching,
    isError: roomError,
  } = useContributionRoom(year);

  const {
    data: breakdownData,
    isFetching: breakdownFetching,
  } = useMonthlyBreakdown(year);

  const {
    data: txData,
    isPending: txPending,
    isFetching: txFetching,
    isError: txError,
  } = useInvestmentTransactions(filters);

  const showDashboardSkeleton = useDelayedPending(roomPending);
  const showActivitySkeleton = useDelayedPending(txPending);

  return (
    <PageLayout>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-semibold text-content-primary">Investments</h1>
          <TabsList className="ml-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

        {/* Dashboard tab */}
        <TabsContent value="dashboard">
          <div className="flex items-center gap-3 mb-6">
            <YearSelector year={year} onChange={setYear} />
          </div>

          {showDashboardSkeleton && <InvestmentSkeleton />}

          {!showDashboardSkeleton && (
            <div className="space-y-6">
              {roomError && !roomData && (
                <EmptyState variant="error" message="Failed to load contribution room data." />
              )}

              {roomData && (
                <ContributionRoomCard data={roomData} isFetching={roomFetching} />
              )}

              {breakdownData && roomData && (
                <div
                  className={cn(
                    'transition-opacity duration-200',
                    breakdownFetching && 'opacity-50'
                  )}
                >
                  <YtdProgressSection
                    months={breakdownData.months}
                    selectedYear={year}
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                    accounts={roomData.accounts}
                  />
                </div>
              )}

              {breakdownData && (
                <div
                  className={cn(
                    'transition-opacity duration-200',
                    breakdownFetching && 'opacity-50'
                  )}
                >
                  <MonthlyBreakdownTable
                    months={breakdownData.months}
                    totals={breakdownData.totals}
                    currentMonth={currentMonth}
                    currentYear={currentYear}
                    selectedYear={year}
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Activity tab */}
        <TabsContent value="activity">
          {showActivitySkeleton && <InvestmentSkeleton />}

          {!showActivitySkeleton && (
            <div className="space-y-4">
              {txError && !txData && (
                <EmptyState variant="error" message="Failed to load investment transactions." />
              )}

              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-content-primary">Activity</h2>
                <Button size="sm" onClick={() => setIsPanelOpen(true)}>
                  Add Transaction
                </Button>
              </div>

              <InvestmentFilters
                filters={{
                  accountId: search.accountId,
                  action: search.action,
                  symbol: search.symbol,
                  startDate: search.startDate,
                  endDate: search.endDate,
                }}
              />

              <ActivityStatsBar aggregates={txData?.aggregates} />

              <InvestmentTransactionsTable
                response={txData}
                isFetching={txFetching}
                page={filters.page}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {isPanelOpen && (
        <ManualInvestmentTransactionPanel onClose={() => setIsPanelOpen(false)} />
      )}
    </PageLayout>
  );
}
