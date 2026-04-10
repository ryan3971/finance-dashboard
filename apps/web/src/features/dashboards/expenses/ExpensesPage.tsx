import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import type { ExpenseCategoryRow, ExpenseMonth } from '@finance/shared';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { YearSelector } from '@/components/common/YearSelector';
import { MONTH_LABELS, fmt } from '@/lib/utils';
import { useExpenseCategories } from './useExpenseCategories';
import { useExpensesDashboard } from './useExpensesDashboard';

interface ColumnMeta {
  thClassName: string;
  tdClassName: string;
}

function pct(part: number, total: number): string | null {
  if (total === 0) return null;
  return ((part / total) * 100).toFixed(1) + '%';
}

function SkeletonTable({
  columns,
  rows,
}: {
  readonly columns: number;
  readonly rows: number;
}) {
  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden mb-8">
      <div className="px-4 py-2.5 bg-surface-subtle border-b border-border-subtle" />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={`skeleton-${i}`}
          className="px-4 py-3 border-t border-border-subtle flex gap-4"
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
      <td className="px-4 py-3 text-sm text-content-secondary w-16">
        {MONTH_LABELS[month.month - 1]}
      </td>
      <td className="px-4 py-3 text-sm font-mono font-medium text-right">
        <span className={hasExpenses ? 'text-danger' : 'text-content-muted'}>
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

export function ExpensesPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [sorting, setSorting] = useState<SortingState>([]);

  const {
    data: expensesData,
    isLoading: expensesLoading,
    isError: expensesError,
  } = useExpensesDashboard(year);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useExpenseCategories(year);

  const annualTotal =
    expensesData?.months.reduce((sum, m) => sum + m.total, 0) ?? 0;

  const columns = useMemo<ColumnDef<ExpenseCategoryRow>[]>(
    () => [
      {
        accessorKey: 'month',
        header: 'Month',
        cell: ({ getValue }) => MONTH_LABELS[getValue<number>() - 1],
        meta: {
          thClassName:
            'px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider',
          tdClassName: 'px-4 py-3 text-sm text-content-secondary',
        } satisfies ColumnMeta,
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => getValue<string | null>() ?? '—',
        meta: {
          thClassName:
            'px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider',
          tdClassName: 'px-4 py-3 text-sm text-content-secondary',
        } satisfies ColumnMeta,
      },
      {
        accessorKey: 'subcategory',
        header: 'Subcategory',
        cell: ({ getValue }) => getValue<string | null>() ?? '—',
        meta: {
          thClassName:
            'px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider',
          tdClassName: 'px-4 py-3 text-sm text-content-secondary',
        } satisfies ColumnMeta,
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: ({ getValue }) => (
          <span className="font-mono font-medium text-danger">
            {fmt(getValue<number>())}
          </span>
        ),
        meta: {
          thClassName:
            'px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right',
          tdClassName: 'px-4 py-3 text-sm text-right',
        } satisfies ColumnMeta,
      },
    ],
    []
  );

  const table = useReactTable({
    data: categoriesData?.rows ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-content-primary">Expenses</h1>
        <YearSelector year={year} onChange={setYear} />
      </div>

      {/* Section 1: Monthly breakdown */}
      <h2 className="text-lg font-semibold text-content-primary mb-4">
        Monthly Breakdown
      </h2>

      {expensesLoading && <SkeletonTable columns={5} rows={12} />}
      {expensesError && (
        <EmptyState variant="error" message="Failed to load expense data." />
      )}

      {expensesData && (
        <>
          <div className="bg-surface rounded-lg border border-border-base overflow-hidden mb-6">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-subtle">
                  <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider w-16">
                    Month
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                    Total Expenses
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                    Need
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                    Want
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                    Other
                  </th>
                </tr>
              </thead>
              <tbody>
                {expensesData.months.map((month) => (
                  <ExpenseMonthRow key={month.month} month={month} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Annual summary */}
          <div className="bg-surface rounded-lg border border-border-base p-6 mb-8">
            <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-1">
              Annual Expenses
            </p>
            <p className="text-2xl font-semibold text-danger font-mono">
              {fmt(annualTotal)}
            </p>
          </div>
        </>
      )}

      {/* Section 2: Category breakdown */}
      <h2 className="text-lg font-semibold text-content-primary mb-4">
        Category Breakdown
      </h2>

      {categoriesLoading && <SkeletonTable columns={4} rows={8} />}
      {categoriesError && (
        <EmptyState variant="error" message="Failed to load category data." />
      )}
      {categoriesData && categoriesData.rows.length === 0 && (
        <EmptyState message="No expense categories for this year." />
      )}
      {categoriesData && categoriesData.rows.length > 0 && (
        <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
          <table className="min-w-full divide-y divide-border-subtle">
            <thead className="bg-surface-subtle">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={
                        (header.column.columnDef.meta as ColumnMeta).thClassName
                      }
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
                      {header.column.getIsSorted() === 'asc'
                        ? ' ↑'
                        : header.column.getIsSorted() === 'desc'
                          ? ' ↓'
                          : ''}
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
                      className={
                        (cell.column.columnDef.meta as ColumnMeta).tdClassName
                      }
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
        </div>
      )}
    </PageLayout>
  );
}
