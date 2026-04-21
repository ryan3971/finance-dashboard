import { useCallback, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { IncomeMonth } from '@finance/shared/types/dashboard';
import { MONTHS_IN_YEAR } from '@finance/shared/constants';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { TransactionTablePane } from '@/components/transactions/TransactionTablePane';
import { YearSelector } from '@/components/common/YearSelector';
import {
  cn,
  fmt,
  getMonthDateRange,
  getYearDateRange,
  MONTH_LABELS,
} from '@/lib/utils';
import { useIncomeDashboard } from './hooks/useIncomeDashboard';

function pct(part: number, total: number) {
  if (total === 0) return null;
  return ((part / total) * 100).toFixed(1) + '%';
}

function IncomeRow({
  month,
  isSelected,
  onClick,
}: {
  readonly month: IncomeMonth;
  readonly isSelected: boolean;
  readonly onClick: () => void;
}) {
  const hasIncome = month.total > 0;
  return (
    <tr
      className={cn(
        'border-t border-border-subtle cursor-pointer transition-colors',
        isSelected ? 'bg-surface-muted' : 'hover:bg-surface-subtle',
      )}
      onClick={onClick}
    >
      <td className="px-4 py-3 text-sm text-content-secondary w-16">
        {MONTH_LABELS[month.month - 1]}
      </td>
      <td className="px-4 py-3 text-sm font-mono font-medium text-right">
        <span className={hasIncome ? 'text-positive' : 'text-content-muted'}>
          {fmt(month.total)}
        </span>
        {month.rebalancingAdjustment > 0 && (
          <span className="block text-xs font-normal text-content-muted">
            {fmt(-month.rebalancingAdjustment)} adj
          </span>
        )}
      </td>
      {month.allocation !== null ? (
        <>
          <td className="px-4 py-3 text-sm text-right">
            <span className="font-mono font-medium text-info">
              {fmt(month.allocation.needs)}
            </span>
            {hasIncome && (
              <span className="block text-xs text-content-muted">
                {pct(month.allocation.needs, month.total)}
              </span>
            )}
          </td>
          <td className="px-4 py-3 text-sm text-right">
            <span className="font-mono font-medium text-accent">
              {fmt(month.allocation.wants)}
            </span>
            {hasIncome && (
              <span className="block text-xs text-content-muted">
                {pct(month.allocation.wants, month.total)}
              </span>
            )}
          </td>
          <td className="px-4 py-3 text-sm text-right">
            <span className="font-mono font-medium text-positive">
              {fmt(month.allocation.investments)}
            </span>
            {hasIncome && (
              <span className="block text-xs text-content-muted">
                {pct(month.allocation.investments, month.total)}
              </span>
            )}
          </td>
        </>
      ) : (
        <td
          colSpan={3}
          className="px-4 py-3 text-sm text-content-muted text-center"
        >
          —
        </td>
      )}
    </tr>
  );
}

function IncomeTotalsRow({
  total,
  rebalancingAdjustment,
  allocation,
  isFiltered,
  onClear,
}: {
  readonly total: number;
  readonly rebalancingAdjustment: number;
  readonly allocation: NonNullable<IncomeMonth['allocation']> | null;
  readonly isFiltered: boolean;
  readonly onClear: () => void;
}) {
  return (
    <tr
      className={cn(
        'border-t-2 border-border-base bg-surface-subtle font-semibold transition-colors',
        isFiltered && 'cursor-pointer hover:bg-surface-muted',
      )}
      onClick={isFiltered ? onClear : undefined}
      title={isFiltered ? 'Show all months' : undefined}
    >
      <td className="px-4 py-3 text-sm text-content-primary">Total</td>
      <td className="px-4 py-3 text-sm font-mono font-medium text-right">
        <span className={total > 0 ? 'text-positive' : 'text-content-muted'}>
          {fmt(total)}
        </span>
        {rebalancingAdjustment > 0 && (
          <span className="block text-xs font-normal text-content-muted">
            {fmt(-rebalancingAdjustment)} adj
          </span>
        )}
      </td>
      {allocation !== null ? (
        <>
          <td className="px-4 py-3 text-sm font-mono font-medium text-right text-info">
            {fmt(allocation.needs)}
          </td>
          <td className="px-4 py-3 text-sm font-mono font-medium text-right text-accent">
            {fmt(allocation.wants)}
          </td>
          <td className="px-4 py-3 text-sm font-mono font-medium text-right text-positive">
            {fmt(allocation.investments)}
          </td>
        </>
      ) : (
        <td
          colSpan={3}
          className="px-4 py-3 text-sm text-content-muted text-center"
        >
          —
        </td>
      )}
    </tr>
  );
}

export function IncomePage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const { data, isLoading, isError } = useIncomeDashboard(year);

  const handleYearChange = useCallback((newYear: number) => {
    setYear(newYear);
    setMonthFilter(null);
  }, []);

  const dateRange = monthFilter
    ? getMonthDateRange(year, monthFilter)
    : getYearDateRange(year);

  const allocationConfigured = data?.months.some((m) => m.allocation !== null);

  const totals = useMemo(() => {
    if (!data) return null;
    const total = data.months.reduce(
      (sum, m) => Math.round((sum + m.total) * 100) / 100,
      0,
    );
    const rebalancingAdjustment = data.months.reduce(
      (sum, m) => Math.round((sum + m.rebalancingAdjustment) * 100) / 100,
      0,
    );
    const allocationMonths = data.months.filter(
      (m): m is IncomeMonth & { allocation: NonNullable<IncomeMonth['allocation']> } =>
        m.allocation !== null,
    );
    const allocation =
      allocationMonths.length > 0
        ? allocationMonths.reduce(
            (acc, m) => ({
              needs: Math.round((acc.needs + m.allocation.needs) * 100) / 100,
              wants: Math.round((acc.wants + m.allocation.wants) * 100) / 100,
              investments:
                Math.round((acc.investments + m.allocation.investments) * 100) / 100,
            }),
            { needs: 0, wants: 0, investments: 0 },
          )
        : null;
    return { total, rebalancingAdjustment, allocation };
  }, [data]);

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-content-primary">Income</h1>
        <YearSelector year={year} onChange={handleYearChange} />
      </div>

      {/* No-config banner */}
      {data && !allocationConfigured && (
        <div className="bg-info-bg border border-info-border rounded-lg px-4 py-3 text-sm text-info mb-6">
          Set your Needs / Wants / Investments allocation percentages in{' '}
          <Link to="/config" className="font-medium underline">
            Config → Preferences
          </Link>{' '}
          to see target breakdowns.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Left column: income breakdown table */}
        <div className="flex flex-col">
          <h2 className="mb-4 text-lg font-semibold text-content-primary">
            Monthly Breakdown
          </h2>

          {/* Loading */}
          {isLoading && (
            <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
              <div className="px-4 py-2.5 bg-surface-subtle border-b border-border-subtle" />
              {Array.from({ length: MONTHS_IN_YEAR }, (_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="px-4 py-3 border-t border-border-subtle flex gap-4"
                >
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {isError && (
            <EmptyState variant="error" message="Failed to load income data." />
          )}

          {/* Table */}
          {data && (
            <DataTable>
              <table className="min-w-full text-left">
                <thead>
                  <tr className="bg-surface-subtle">
                    <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider w-16">
                      Month
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                      Total Income
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                      Needs
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                      Wants
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                      Investments
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((month) => (
                    <IncomeRow
                      key={month.month}
                      month={month}
                      isSelected={monthFilter === month.month}
                      onClick={() =>
                        setMonthFilter(
                          monthFilter === month.month ? null : month.month,
                        )
                      }
                    />
                  ))}
                  {totals && (
                    <IncomeTotalsRow
                      total={totals.total}
                      rebalancingAdjustment={totals.rebalancingAdjustment}
                      allocation={totals.allocation}
                      isFiltered={monthFilter !== null}
                      onClear={() => setMonthFilter(null)}
                    />
                  )}
                </tbody>
              </table>
            </DataTable>
          )}
        </div>

        {/* Right column: income transactions */}
        <div className="flex flex-col min-w-0">
          <h2 className="mb-4 text-lg font-semibold text-content-primary">
            Income Transactions
          </h2>
          <TransactionTablePane
            key={`${year}-${monthFilter ?? 'all'}`}
            className="flex-1"
            presetFilters={{ isIncome: true }}
            defaultFilters={{
              startDate: dateRange.start,
              endDate: dateRange.end,
            }}
            onFilterChange={(newFilters) => {
              if (
                newFilters.startDate !== dateRange.start ||
                newFilters.endDate !== dateRange.end
              ) {
                setMonthFilter(null);
              }
            }}
          />
        </div>
      </div>
    </PageLayout>
  );
}
