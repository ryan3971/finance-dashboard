import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type CellContext,
  type ColumnDef,
  type ExpandedState,
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

// TODO: consider extracting component in this file to another file to reduce its size

const CURRENT_YEAR = new Date().getFullYear();
const TH_BASE =
  'px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider';
const TD_BASE = 'px-4 py-3 text-sm text-content-secondary';

function sortIndicator(dir: false | 'asc' | 'desc'): string {
  if (dir === 'asc') return ' ↑';
  if (dir === 'desc') return ' ↓';
  return '';
}

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
    <div className="overflow-hidden mb-8 bg-surface rounded-lg border border-border-base">
      <div className="px-4 py-2.5 bg-surface-subtle border-b border-border-subtle" />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={`skeleton-${i}`}
          className="flex gap-4 px-4 py-3 border-t border-border-subtle"
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
      <span className={cn('font-mono font-medium', colorClass)}>{fmt(value)}</span>
      {total > 0 && (
        <span className="block text-xs text-content-muted">{pct(value, total)}</span>
      )}
    </td>
  );
}

function ExpenseMonthRow({ month }: { readonly month: ExpenseMonth }) {
  return (
    <tr className="border-t border-border-subtle">
      <td className={cn(TD_BASE, 'w-16')}>{MONTH_LABELS[month.month - 1]}</td>
      <td className="px-4 py-3 text-right text-sm font-mono font-medium">
        <span className={cn(month.total > 0 ? 'text-danger' : 'text-content-muted')}>
          {fmt(month.total)}
        </span>
      </td>
      <MonthAmountCell value={month.need} total={month.total} colorClass="text-info" />
      <MonthAmountCell value={month.want} total={month.total} colorClass="text-accent" />
      <MonthAmountCell value={month.other} total={month.total} colorClass="text-content-secondary" />
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
    <tr className="border-t-2 border-border-base bg-surface-subtle font-semibold">
      <td className="px-4 py-3 text-sm text-content-primary">Total</td>
      <td className="px-4 py-3 text-right text-sm font-mono font-medium">
        <span className={cn(total > 0 ? 'text-danger' : 'text-content-muted')}>
          {fmt(total)}
        </span>
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

function ExpenseMonthlyBreakdown({ year }: { readonly year: number }) {
  const { data, isLoading, isError } = useExpensesDashboard(year);

  const totals = useMemo(
    () =>
      data?.months.reduce(
        (acc, m) => ({
          total: acc.total + m.total,
          need: acc.need + m.need,
          want: acc.want + m.want,
          other: acc.other + m.other,
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

      {data && (
        data.annualTotal === 0 ? (
          <EmptyState message="No expenses for this year." />
        ) : (
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
                {totals && <ExpenseMonthTotalsRow {...totals} />}
              </tbody>
            </table>
          </DataTable>
        )
      )}
    </>
  );
}

// ─── Category tree types & transform ─────────────────────────────────────────

interface ExpenseCategoryTreeRow {
  key: string;
  label: string;
  total: number;
  // % of grand total for category rows; % of parent category total for subcategory rows
  pct: number;
  subRows?: ExpenseCategoryTreeRow[];
}

// Use a sentinel key for null-category rows to avoid collision with a real
// category that happens to be named "Uncategorized".
function groupByCategoryKey(
  filtered: ExpenseCategoryRow[],
): Map<string, { label: string; rows: ExpenseCategoryRow[] }> {
  const categoryMap = new Map<string, { label: string; rows: ExpenseCategoryRow[] }>();
  for (const row of filtered) {
    const catKey = row.category ?? '__null_category__';
    const catLabel = row.category ?? 'Uncategorized';
    let entry = categoryMap.get(catKey);
    if (!entry) {
      entry = { label: catLabel, rows: [] };
      categoryMap.set(catKey, entry);
    }
    entry.rows.push(row);
  }
  return categoryMap;
}

// Separate named subcategory rows from null-subcategory transactions.
// Null-subcategory totals are absorbed into a dedicated "Uncategorized" child
// rather than silently inflating the parent row only.
function buildSubRows(
  catKey: string,
  catRows: ExpenseCategoryRow[],
  categoryTotal: number,
): ExpenseCategoryTreeRow[] {
  const subcategoryMap = new Map<string, number>();
  let uncategorizedSubtotal = 0;

  for (const row of catRows) {
    if (row.subcategory === null) {
      uncategorizedSubtotal += row.total;
    } else {
      subcategoryMap.set(row.subcategory, (subcategoryMap.get(row.subcategory) ?? 0) + row.total);
    }
  }

  const subRows: ExpenseCategoryTreeRow[] = Array.from(subcategoryMap.entries())
    .map(([label, total]) => ({
      key: `${catKey}::${label}`,
      label,
      total,
      pct: categoryTotal > 0 ? total / categoryTotal : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Always append the "Uncategorized" child last when null-subcategory transactions exist.
  if (uncategorizedSubtotal > 0) {
    subRows.push({
      key: `${catKey}::__null_sub__`,
      label: 'Uncategorized',
      total: uncategorizedSubtotal,
      pct: categoryTotal > 0 ? uncategorizedSubtotal / categoryTotal : 0,
    });
  }

  return subRows;
}

function buildCategoryTree(
  rows: ExpenseCategoryRow[],
  monthFilter: number | null,
): ExpenseCategoryTreeRow[] {
  const filtered =
    monthFilter === null ? rows : rows.filter((r) => r.month === monthFilter);

  const grandTotal = filtered.reduce((sum, r) => sum + r.total, 0);
  if (grandTotal === 0) return [];

  const categoryMap = groupByCategoryKey(filtered);
  const treeRows: ExpenseCategoryTreeRow[] = [];

  for (const [catKey, { label: catLabel, rows: catRows }] of categoryMap) {
    const categoryTotal = catRows.reduce((sum, r) => sum + r.total, 0);
    const subRows = buildSubRows(catKey, catRows, categoryTotal);
    treeRows.push({
      key: catKey,
      label: catLabel,
      total: categoryTotal,
      pct: grandTotal > 0 ? categoryTotal / grandTotal : 0,
      // subRows is always non-empty here: every category has at least one named
      // subcategory or an "Uncategorized" child from null-subcategory transactions.
      subRows: subRows.length > 0 ? subRows : undefined,
    });
  }

  // Sort: null-category ("Uncategorized") always last; named categories by total desc.
  treeRows.sort((a, b) => {
    if (a.key === '__null_category__') return 1;
    if (b.key === '__null_category__') return -1;
    return b.total - a.total;
  });

  return treeRows;
}

// ─── Month date range helper ──────────────────────────────────────────────────

function getMonthDateRange(year: number, month: number) {
  const mm = String(month).padStart(2, '0');
  // new Date(year, month, 0) gives the last day of `month` (1-indexed).
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

// ─── ExpenseCategoryBreakdown ─────────────────────────────────────────────────

function renderLabelCell({ row }: CellContext<ExpenseCategoryTreeRow, unknown>) {
  return (
    <CategoryLabelCell
      depth={row.depth}
      isExpanded={row.getIsExpanded()}
      label={row.original.label}
      onToggle={row.getToggleExpandedHandler()}
    />
  );
}

function renderTotalCell({ getValue }: CellContext<ExpenseCategoryTreeRow, unknown>) {
  return (
    <span className="font-mono font-medium text-danger">
      {fmt(getValue<number>())}
    </span>
  );
}

function renderPctCell({ getValue, row }: CellContext<ExpenseCategoryTreeRow, unknown>) {
  return (
    <span className="text-xs font-mono text-content-muted">
      {(getValue<number>() * 100).toFixed(1)}%
      {row.depth === 1 && (
        <span className="ml-1 text-content-disabled">of cat.</span>
      )}
    </span>
  );
}

function CategoryLabelCell({
  depth,
  isExpanded,
  label,
  onToggle,
}: {
  readonly depth: number;
  readonly isExpanded: boolean;
  readonly label: string;
  readonly onToggle: () => void;
}) {
  return (
    <div className={cn('flex items-center gap-2', depth === 1 && 'pl-8')}>
      {depth === 0 ? (
        <button
          onClick={onToggle}
          className="w-4 h-4 text-xs font-mono leading-none flex-shrink-0 text-content-muted hover:text-content-primary"
        >
          {isExpanded ? '−' : '+'}
        </button>
      ) : (
        <span className="w-4 flex-shrink-0" />
      )}
      <span
        className={cn(
          'text-sm',
          depth === 0 ? 'font-medium text-content-primary' : 'text-content-secondary',
        )}
      >
        {label}
      </span>
    </div>
  );
}

function ExpenseCategoryBreakdown({
  year,
  monthFilter,
}: {
  readonly year: number;
  readonly monthFilter: number | null;
}) {
  const { data, isLoading, isError } = useExpenseCategories(year);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);

  // Reset to all-expanded whenever the visible data set changes.
  useEffect(() => {
    setExpanded(true);
  }, [year, monthFilter]);

  const treeData = useMemo(
    () => buildCategoryTree(data?.rows ?? [], monthFilter),
    [data, monthFilter],
  );

  const isAllExpanded = expanded === true;

  const columns = useMemo<ColumnDef<ExpenseCategoryTreeRow>[]>(
    () => [
      {
        id: 'label',
        accessorKey: 'label',
        header: 'Category',
        // To disable sorting below depth 0 in the future, replace getSortedRowModel
        // with a custom sort function that returns 0 for child rows, preserving their
        // insertion order while still sorting top-level category rows.
        cell: renderLabelCell,
        meta: { thClassName: TH_BASE, tdClassName: 'px-4 py-3' },
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: renderTotalCell,
        meta: {
          thClassName: cn(TH_BASE, 'text-right'),
          tdClassName: 'px-4 py-3 text-sm text-right',
        },
      },
      {
        accessorKey: 'pct',
        header: '% of Total',
        // Percentage is derived from total — sorting by it would duplicate sorting by total.
        enableSorting: false,
        cell: renderPctCell,
        meta: {
          thClassName: cn(TH_BASE, 'text-right'),
          tdClassName: 'px-4 py-3 text-right',
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: treeData,
    columns,
    getSubRows: (row) => row.subRows,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-content-primary">
          Category Breakdown
        </h2>
        {treeData.length > 0 && (
          <button
            onClick={() => setExpanded(isAllExpanded ? {} : true)}
            className="text-xs text-content-muted hover:text-content-primary transition-colors"
          >
            {isAllExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}
      </div>

      {isLoading && <SkeletonTable columns={3} rows={8} />}
      {isError && (
        <EmptyState variant="error" message="Failed to load category data." />
      )}
      {data && treeData.length === 0 && (
        <EmptyState message="No expense categories for this year." />
      )}
      {data && treeData.length > 0 && (
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
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {sortIndicator(header.column.getIsSorted())}
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
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [monthFilter, setMonthFilter] = useState<number | null>(null);

  function handleYearChange(newYear: number) {
    setYear(newYear);
    setMonthFilter(null);
  }

  const dateRange = monthFilter
    ? getMonthDateRange(year, monthFilter)
    : { start: `${year}-01-01`, end: `${year}-12-31` };

  return (
    <PageLayout>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-content-primary">Expenses</h1>
        <YearSelector year={year} onChange={handleYearChange} />
        <select
          className="select-base"
          value={monthFilter ?? ''}
          onChange={(e) =>
            setMonthFilter(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">All Months</option>
          {MONTH_LABELS.map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Monthly breakdown and expense transactions side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start mb-8">
        <div>
          <h2 className="mb-4 text-lg font-semibold text-content-primary">
            Monthly Breakdown
          </h2>
          <ExpenseMonthlyBreakdown year={year} />
        </div>

        <div className="min-w-0">
          <h2 className="mb-4 text-lg font-semibold text-content-primary">
            Expense Transactions
          </h2>
          <TransactionTablePane
            key={`${year}-${monthFilter ?? 'all'}`}
            presetFilters={{ isIncome: false }}
            defaultFilters={{
              startDate: dateRange.start,
              endDate: dateRange.end,
            }}
          />
        </div>
      </div>

      {/* Category breakdown: full width */}
      <ExpenseCategoryBreakdown year={year} monthFilter={monthFilter} />
    </PageLayout>
  );
}
