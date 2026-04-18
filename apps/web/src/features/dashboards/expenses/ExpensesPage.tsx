import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type CellContext,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import type {
  ExpenseCategoryRow,
  ExpenseMonth,
} from '@finance/shared/types/dashboard';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { TransactionTablePane } from '@/components/transactions/TransactionTablePane';
import { YearSelector } from '@/components/common/YearSelector';
import { cn, MONTH_LABELS, fmt } from '@/lib/utils';
import { useExpenseCategories } from './useExpenseCategories';
import { useExpensesDashboard } from './useExpensesDashboard';
import { MONTHS_IN_YEAR } from '@finance/shared/constants';

const CURRENT_YEAR = new Date().getFullYear();
const TH_BASE =
  'px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider';
const TD_BASE = 'px-4 py-3 text-sm text-content-secondary';

function pct(part: number, total: number): string | null {
  if (total === 0) return null;
  return `${((part / total) * 100).toFixed(1)}%`;
}

function SkeletonTable({
  columns,
  rows,
}: {
  readonly columns: number;
  readonly rows: number;
}) {
  return (
    <div
      className={cn(
        // layout
        'overflow-hidden mb-8',
        // visual
        'bg-surface rounded-lg border border-border-base',
      )}
    >
      <div
        className={cn(
          // layout
          'px-4 py-2.5',
          // visual
          'bg-surface-subtle border-b border-border-subtle',
        )}
      />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={`skeleton-${i}`}
          className={cn(
            // layout
            'flex gap-4 px-4 py-3',
            // visual
            'border-t border-border-subtle',
          )}
        >
          <Skeleton className="h-4 w-8" />
          {Array.from({ length: columns - 1 }, (_, j) => (
            <Skeleton key={`skeleton-col-${j}`} className="h-4 w-20 ml-auto" />
          ))}
        </div>
      ))}
    </div>
  );
}

function ExpenseMonthRow({ month }: { readonly month: ExpenseMonth }) {
  const hasExpenses = month.total > 0;
  return (
    <tr className="border-t border-border-subtle">
      <td className={cn(TD_BASE, 'w-16')}>{MONTH_LABELS[month.month - 1]}</td>
      <td
        className={cn(
          // layout
          'px-4 py-3 text-right',
          // visual
          'text-sm font-mono font-medium',
        )}
      >
        <span className={cn(hasExpenses ? 'text-danger' : 'text-content-muted')}>
          {fmt(month.total)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-right">
        <span className="font-mono font-medium text-info">
          {fmt(month.need)}
        </span>
        {hasExpenses && (
          <span className="block text-xs text-content-muted">
            {pct(month.need, month.total)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-right">
        <span className="font-mono font-medium text-accent">
          {fmt(month.want)}
        </span>
        {hasExpenses && (
          <span className="block text-xs text-content-muted">
            {pct(month.want, month.total)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-right">
        <span className="font-mono font-medium text-content-secondary">
          {fmt(month.other)}
        </span>
        {hasExpenses && (
          <span className="block text-xs text-content-muted">
            {pct(month.other, month.total)}
          </span>
        )}
      </td>
    </tr>
  );
}

function ExpenseMonthTotalsRow({
  total,
  need,
  want,
  other,
}: {
  readonly total: number;
  readonly need: number;
  readonly want: number;
  readonly other: number;
}) {
  return (
    <tr
      className={cn(
        // visual
        'border-t-2 border-border-base bg-surface-subtle font-semibold',
      )}
    >
      <td
        className={cn(
          // layout
          'px-4 py-3',
          // visual
          'text-sm text-content-primary',
        )}
      >
        Total
      </td>
      <td
        className={cn(
          // layout
          'px-4 py-3 text-right',
          // visual
          'text-sm font-mono font-medium',
        )}
      >
        <span className={cn(total > 0 ? 'text-danger' : 'text-content-muted')}>
          {fmt(total)}
        </span>
      </td>
      <td
        className={cn(
          // layout
          'px-4 py-3 text-right',
          // visual
          'text-sm font-mono font-medium text-info',
        )}
      >
        {fmt(need)}
      </td>
      <td
        className={cn(
          // layout
          'px-4 py-3 text-right',
          // visual
          'text-sm font-mono font-medium text-accent',
        )}
      >
        {fmt(want)}
      </td>
      <td
        className={cn(
          // layout
          'px-4 py-3 text-right',
          // visual
          'text-sm font-mono font-medium text-content-secondary',
        )}
      >
        {fmt(other)}
      </td>
    </tr>
  );
}

function ExpenseMonthlyBreakdown({ year }: { readonly year: number }) {
  const { data, isLoading, isError } = useExpensesDashboard(year);

  const totals = useMemo(
    () =>
      data?.months.reduce(
        (acc, m) => ({
          total: Math.round((acc.total + m.total) * 100) / 100,
          need: Math.round((acc.need + m.need) * 100) / 100,
          want: Math.round((acc.want + m.want) * 100) / 100,
          other: Math.round((acc.other + m.other) * 100) / 100,
        }),
        { total: 0, need: 0, want: 0, other: 0 },
      ) ?? null,
    [data?.months],
  );

  return (
    <>
      {isLoading && <SkeletonTable columns={5} rows={MONTHS_IN_YEAR} />}
      {isError && (
        <EmptyState variant="error" message="Failed to load expense data." />
      )}

      {data && data.annualTotal === 0 && (
        <EmptyState message="No expenses for this year." />
      )}

      {data && data.annualTotal > 0 && (
        <DataTable className="mb-6">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-surface-subtle">
                <th className={cn(TH_BASE, 'w-16')}>Month</th>
                <th className={cn(TH_BASE, 'text-right')}>Total Expenses</th>
                <th className={cn(TH_BASE, 'text-right')}>Need</th>
                <th className={cn(TH_BASE, 'text-right')}>Want</th>
                <th className={cn(TH_BASE, 'text-right')}>Other</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((month) => (
                <ExpenseMonthRow key={month.month} month={month} />
              ))}
              {totals && (
                <ExpenseMonthTotalsRow
                  total={totals.total}
                  need={totals.need}
                  want={totals.want}
                  other={totals.other}
                />
              )}
            </tbody>
          </table>
        </DataTable>
      )}
    </>
  );
}

function TotalCell({
  getValue,
}: Readonly<CellContext<ExpenseCategoryRow, unknown>>) {
  return (
    <span className="font-mono font-medium text-danger">
      {fmt(getValue<number>())}
    </span>
  );
}

function ExpenseCategoryBreakdown({ year }: { readonly year: number }) {
  const { data, isLoading, isError } = useExpenseCategories(year);
  const [sorting, setSorting] = useState<SortingState>([]);

  const tableData = useMemo(() => data?.rows ?? [], [data]);

  const columns = useMemo<ColumnDef<ExpenseCategoryRow>[]>(
    () => [
      {
        accessorKey: 'month',
        header: 'Month',
        cell: ({ getValue }) => MONTH_LABELS[getValue<number>() - 1],
        meta: { thClassName: TH_BASE, tdClassName: TD_BASE },
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => getValue<string | null>() ?? '—',
        meta: { thClassName: TH_BASE, tdClassName: TD_BASE },
      },
      {
        accessorKey: 'subcategory',
        header: 'Subcategory',
        cell: ({ getValue }) => getValue<string | null>() ?? '—',
        meta: { thClassName: TH_BASE, tdClassName: TD_BASE },
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: TotalCell,
        meta: {
          thClassName: cn(TH_BASE, 'text-right'),
          tdClassName: 'px-4 py-3 text-sm text-right',
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <h2
        className={cn(
          // layout
          'mb-4',
          // visual
          'text-lg font-semibold text-content-primary',
        )}
      >
        Category Breakdown
      </h2>

      {isLoading && <SkeletonTable columns={4} rows={8} />}
      {isError && (
        <EmptyState variant="error" message="Failed to load category data." />
      )}
      {data && data.rows.length === 0 && (
        <EmptyState message="No expense categories for this year." />
      )}
      {data && data.rows.length > 0 && (
        <DataTable>
          <table className="min-w-full divide-y divide-border-subtle">
            <thead className="bg-surface-subtle">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={header.column.columnDef.meta?.thClassName}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        cursor: header.column.getCanSort()
                          ? 'pointer'
                          : 'default',
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {(() => {
                        const sorted = header.column.getIsSorted();
                        if (sorted === 'asc') return ' ↑';
                        if (sorted === 'desc') return ' ↓';
                        return '';
                      })()}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cell.column.columnDef.meta?.tdClassName}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </>
  );
}

export function ExpensesPage() {
  const [year, setYear] = useState(CURRENT_YEAR);

  return (
    <PageLayout>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-content-primary">Expenses</h1>
        <YearSelector year={year} onChange={setYear} />
      </div>

      {/* Monthly breakdown and expense transactions side by side */}
      <div className="flex gap-6 items-start mb-8">
        <div className="flex-none">
          <h2
            className={cn(
              // layout
              'mb-4',
              // visual
              'text-lg font-semibold text-content-primary',
            )}
          >
            Monthly Breakdown
          </h2>
          <ExpenseMonthlyBreakdown year={year} />
        </div>

        <div className="flex-1 min-w-0">
          <h2
            className={cn(
              // layout
              'mb-4',
              // visual
              'text-lg font-semibold text-content-primary',
            )}
          >
            Expense Transactions
          </h2>
          <TransactionTablePane
            key={year}
            presetFilters={{ isIncome: false }}
            defaultFilters={{
              startDate: `${year}-01-01`,
              endDate: `${year}-12-31`,
            }}
          />
        </div>
      </div>

      {/* Category breakdown: full width */}
      <ExpenseCategoryBreakdown year={year} />
    </PageLayout>
  );
}
