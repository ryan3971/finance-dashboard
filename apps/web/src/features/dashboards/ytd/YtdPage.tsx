import { useMemo, useState } from 'react';
import type { YtdMonth } from '@finance/shared/types/dashboard';
import { MONTHS_IN_YEAR } from '@finance/shared/constants';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { YearSelector } from '@/components/common/YearSelector';
import { MONTH_LABELS, fmt } from '@/lib/utils';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { useYtdDashboard } from './hooks/useYtdDashboard';

type DataMonth = Extract<YtdMonth, { spendingIncome: number }>;

type AmountVariant = 'income' | 'expense' | 'net' | 'want' | 'need';

function amountColorClass(value: number, variant: AmountVariant): string {
  switch (variant) {
    case 'income':
      return value > 0 ? 'text-positive' : 'text-content-muted';
    case 'expense':
      return value > 0 ? 'text-danger' : 'text-content-muted';
    case 'net':
      return value >= 0 ? 'text-positive' : 'text-danger';
    case 'want':
      return value > 0 ? 'text-accent' : 'text-content-muted';
    case 'need':
      return value > 0 ? 'text-info' : 'text-content-muted';
  }
}

function YtdAmountCell({
  value,
  variant,
  rebalancingAdjustment,
}: {
  readonly value: number;
  readonly variant: AmountVariant;
  readonly rebalancingAdjustment?: number;
}) {
  return (
    <td className="px-4 py-3 text-sm text-right font-mono font-medium">
      <span className={amountColorClass(value, variant)}>{fmt(value)}</span>
      {rebalancingAdjustment !== undefined && rebalancingAdjustment > 0 && (
        <span className="block text-xs font-normal text-content-muted">
          {fmt(-rebalancingAdjustment)} adj
        </span>
      )}
    </td>
  );
}

const SKELETON_ROWS = Array.from({ length: MONTHS_IN_YEAR }, (_, i) => i);

function YtdSkeleton() {
  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="px-4 py-2.5 bg-surface-subtle border-b border-border-subtle" />
      {SKELETON_ROWS.map((i) => (
        <div
          key={`skeleton-${i}`}
          className="px-4 py-3 border-t border-border-subtle flex gap-4"
        >
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-24 ml-auto" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function YtdRow({ month }: { readonly month: YtdMonth }) {
  const label = MONTH_LABELS[month.month - 1] ?? String(month.month);

  if (month.spendingIncome === null) {
    return (
      <tr className="border-t border-border-subtle">
        <td className="px-4 py-3 text-sm text-content-secondary w-16">
          {label}
        </td>
        <td className="px-4 py-3 text-sm text-content-muted text-right">—</td>
        <td className="px-4 py-3 text-sm text-content-muted text-right">—</td>
        <td className="px-4 py-3 text-sm text-content-muted text-right">—</td>
        <td className="px-4 py-3 text-sm text-content-muted text-right">—</td>
        <td className="px-4 py-3 text-sm text-content-muted text-right">—</td>
      </tr>
    );
  }

  const { spendingIncome, expenses, netSpendingIncome, wants, needs, rebalancingAdjustment } = month;

  return (
    <tr className="border-t border-border-subtle">
      <td className="px-4 py-3 text-sm text-content-secondary w-16">{label}</td>
      <YtdAmountCell value={spendingIncome} variant="income" />
      <YtdAmountCell value={expenses} variant="expense" rebalancingAdjustment={rebalancingAdjustment} />
      <YtdAmountCell value={netSpendingIncome} variant="net" />
      <YtdAmountCell value={wants} variant="want" />
      <YtdAmountCell value={needs} variant="need" />
    </tr>
  );
}

function YtdTotalsRow({
  totals,
}: {
  readonly totals: Omit<DataMonth, 'month'>;
}) {
  const { spendingIncome, expenses, netSpendingIncome, wants, needs, rebalancingAdjustment } = totals;
  return (
    <tr className="border-t-2 border-border-base bg-surface-subtle font-semibold">
      <td className="px-4 py-3 text-sm text-content-primary">Total</td>
      <YtdAmountCell value={spendingIncome} variant="income" />
      <YtdAmountCell value={expenses} variant="expense" rebalancingAdjustment={rebalancingAdjustment} />
      <YtdAmountCell value={netSpendingIncome} variant="net" />
      <YtdAmountCell value={wants} variant="want" />
      <YtdAmountCell value={needs} variant="need" />
    </tr>
  );
}

export function YtdPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data, isPending, isFetching, isError } = useYtdDashboard(year);
  const showSkeleton = useDelayedPending(isPending);

  const dataMonths = useMemo(
    () =>
      data?.months.filter((m): m is DataMonth => m.spendingIncome !== null) ??
      [],
    [data?.months]
  );

  const totals = useMemo(
    () =>
      dataMonths.reduce(
        (acc, m) => ({
          spendingIncome:
          // Round to 2 decimal places after each addition to prevent floating point drift issues
            Math.round((acc.spendingIncome + m.spendingIncome) * 100) / 100,
          expenses: Math.round((acc.expenses + m.expenses) * 100) / 100,
          netSpendingIncome:
            Math.round((acc.netSpendingIncome + m.netSpendingIncome) * 100) /
            100,
          wants: Math.round((acc.wants + m.wants) * 100) / 100,
          needs: Math.round((acc.needs + m.needs) * 100) / 100,
          rebalancingAdjustment:
            Math.round((acc.rebalancingAdjustment + m.rebalancingAdjustment) * 100) / 100,
        }),
        {
          spendingIncome: 0,
          expenses: 0,
          netSpendingIncome: 0,
          wants: 0,
          needs: 0,
          rebalancingAdjustment: 0,
        }
      ),
    [dataMonths]
  );

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-content-primary">YTD</h1>
        <YearSelector year={year} onChange={setYear} />
      </div>

      {/* Loading */}
      {showSkeleton && <YtdSkeleton />}

      {/* Error */}
      {isError && (
        <EmptyState variant="error" message="Failed to load YTD data." />
      )}

      {/* Table */}
      {data && (
        <DataTable className={`transition-opacity duration-200 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-surface-subtle">
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider w-16">
                  Month
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                  Spending Income
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                  Expenses
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                  Net Spending Income
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                  Wants
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                  Needs
                </th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((month) => (
                <YtdRow key={month.month} month={month} />
              ))}
              {dataMonths.length > 0 && <YtdTotalsRow totals={totals} />}
            </tbody>
          </table>
        </DataTable>
      )}
    </PageLayout>
  );
}
