import { useMemo } from 'react';
import type { ExpenseMonth } from '@finance/shared/types/dashboard';
import { MONTHS_IN_YEAR } from '@finance/shared/constants';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { cn, fmt, fmtPct, MONTH_LABELS } from '@/lib/utils';
import { useExpensesDashboard } from '../hooks/useExpensesDashboard';

function MonthAmountCell({
  value,
  total,
  colorClass,
}: {
  readonly value: number;
  readonly total: number;
  readonly colorClass: string;
}) {
  return (
    <td className="px-4 py-3 text-sm text-right">
      <span className={cn('font-mono font-medium', colorClass)}>
        {fmt(value)}
      </span>
      {total > 0 && (
        <span className="block text-xs text-content-muted">
          {fmtPct(value, total)}
        </span>
      )}
    </td>
  );
}

function ExpenseMonthRow({
  month,
  isSelected,
  onClick,
}: {
  readonly month: ExpenseMonth;
  readonly isSelected: boolean;
  readonly onClick: () => void;
}) {
  return (
    <tr
      className={cn(
        'border-t border-border-subtle cursor-pointer transition-colors',
        isSelected ? 'bg-surface-muted' : 'hover:bg-surface-subtle'
      )}
      onClick={onClick}
    >
      <td className={cn('td-class', 'w-16')}>
        {MONTH_LABELS[month.month - 1]}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono font-medium">
        <span
          className={month.total > 0 ? 'text-danger' : 'text-content-muted'}
        >
          {fmt(month.total)}
        </span>
        {month.rebalancingAdjustment > 0 && (
          <span className="block text-xs font-normal text-content-muted">
            {fmt(-month.rebalancingAdjustment)} adj
          </span>
        )}
      </td>
      <MonthAmountCell
        value={month.need}
        total={month.total}
        colorClass="text-info"
      />
      <MonthAmountCell
        value={month.want}
        total={month.total}
        colorClass="text-accent"
      />
      <MonthAmountCell
        value={month.other}
        total={month.total}
        colorClass="text-content-secondary"
      />
    </tr>
  );
}

function ExpenseMonthTotalsRow({
  total,
  need,
  want,
  other,
  rebalancingAdjustment,
  isFiltered,
  onClear,
}: {
  readonly total: number;
  readonly need: number;
  readonly want: number;
  readonly other: number;
  readonly rebalancingAdjustment: number;
  readonly isFiltered: boolean;
  readonly onClear: () => void;
}) {
  return (
    <tr
      className={cn(
        'border-t-2 border-border-base bg-surface-subtle font-semibold transition-colors',
        isFiltered && 'cursor-pointer hover:bg-surface-muted'
      )}
      onClick={isFiltered ? onClear : undefined}
      title={isFiltered ? 'Show all months' : undefined}
    >
      <td className="px-4 py-3 text-sm text-content-primary">Total</td>
      <td className="px-4 py-3 text-right text-sm font-mono font-medium">
        <span className={total > 0 ? 'text-danger' : 'text-content-muted'}>
          {fmt(total)}
        </span>
        {rebalancingAdjustment > 0 && (
          <span className="block text-xs font-normal text-content-muted">
            {fmt(-rebalancingAdjustment)} adj
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono font-medium text-info">
        {fmt(need)}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono font-medium text-accent">
        {fmt(want)}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono font-medium text-content-secondary">
        {fmt(other)}
      </td>
    </tr>
  );
}

export function ExpenseMonthlyBreakdown({
  year,
  selectedMonth,
  onMonthSelect,
}: {
  readonly year: number;
  readonly selectedMonth: number | null;
  readonly onMonthSelect: (month: number | null) => void;
}) {
  const { data, isLoading, isError } = useExpensesDashboard(year);

  // Only sum need/want/other/rebalancingAdjustment — total comes from data.annualTotal to avoid float drift.
  const subtotals = useMemo(
    () =>
      data?.months.reduce(
        (acc, m) => ({
          need: acc.need + m.need,
          want: acc.want + m.want,
          other: acc.other + m.other,
          rebalancingAdjustment: acc.rebalancingAdjustment + m.rebalancingAdjustment,
        }),
        { need: 0, want: 0, other: 0, rebalancingAdjustment: 0 }
      ) ?? null,
    [data?.months]
  );

  return (
    <>
      {isLoading && <SkeletonTable columns={5} rows={MONTHS_IN_YEAR} />}
      {isError && (
        <EmptyState variant="error" message="Failed to load expense data." />
      )}

      {data &&
        (data.annualTotal === 0 ? (
          <EmptyState message="No expenses for this year." />
        ) : (
          <DataTable className="mb-6">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-surface-subtle">
                  <th className={cn('th-class', 'w-16')}>Month</th>
                  <th className={cn('th-class', 'text-right')}>
                    Total Expenses
                  </th>
                  <th className={cn('th-class', 'text-right')}>Need</th>
                  <th className={cn('th-class', 'text-right')}>Want</th>
                  <th className={cn('th-class', 'text-right')}>Other</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((month) => (
                  <ExpenseMonthRow
                    key={month.month}
                    month={month}
                    isSelected={selectedMonth === month.month}
                    // Toggle: clicking the active month deselects (returns to all months)
                    onClick={() =>
                      onMonthSelect(
                        selectedMonth === month.month ? null : month.month
                      )
                    }
                  />
                ))}
                {subtotals && (
                  <ExpenseMonthTotalsRow
                    total={data.annualTotal}
                    need={subtotals.need}
                    want={subtotals.want}
                    other={subtotals.other}
                    rebalancingAdjustment={subtotals.rebalancingAdjustment}
                    isFiltered={selectedMonth !== null}
                    onClear={() => onMonthSelect(null)}
                  />
                )}
              </tbody>
            </table>
          </DataTable>
        ))}
    </>
  );
}
