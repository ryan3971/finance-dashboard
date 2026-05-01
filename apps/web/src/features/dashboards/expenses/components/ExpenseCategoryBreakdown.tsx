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
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { cn, fmt, sortIndicator } from '@/lib/utils';
import { useExpenseCategories } from '../hooks/useExpenseCategories';
import {
  buildCategoryTree,
  type ExpenseCategoryTreeRow,
} from '../utils/categoryTree';

const CATEGORY_SKELETON_ROWS = 8;

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
          depth === 0
            ? 'font-medium text-content-primary'
            : 'text-content-secondary'
        )}
      >
        {label}
      </span>
    </div>
  );
}

function renderLabelCell({
  row,
}: CellContext<ExpenseCategoryTreeRow, unknown>) {
  return (
    <CategoryLabelCell
      depth={row.depth}
      isExpanded={row.getIsExpanded()}
      label={row.original.label}
      onToggle={row.getToggleExpandedHandler()}
    />
  );
}

function renderTotalCell({
  getValue,
}: CellContext<ExpenseCategoryTreeRow, unknown>) {
  return (
    <span className="font-mono font-medium text-danger">
      {fmt(getValue<number>())}
    </span>
  );
}

function renderShareCell({
  getValue,
  row,
}: CellContext<ExpenseCategoryTreeRow, unknown>) {
  return (
    <span className="text-xs font-mono text-content-muted">
      {(getValue<number>() * 100).toFixed(1)}%
      {row.depth === 1 && (
        <span className="ml-1 text-content-disabled">of cat.</span>
      )}
    </span>
  );
}

// Columns are fully static — no closure over component state — so this lives at
// module scope rather than inside a useMemo.
const CATEGORY_COLUMNS: ColumnDef<ExpenseCategoryTreeRow>[] = [
  {
    id: 'label',
    accessorKey: 'label',
    header: 'Category',
    // To disable sorting below depth 0 in the future, replace getSortedRowModel
    // with a custom sort function that returns 0 for child rows, preserving their
    // insertion order while still sorting top-level category rows.
    cell: renderLabelCell,
    meta: { thClassName: 'th-class', tdClassName: 'px-4 py-3' },
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: renderTotalCell,
    meta: {
      thClassName: cn('th-class', 'text-right'),
      tdClassName: 'px-4 py-3 text-sm text-right',
    },
  },
  {
    accessorKey: 'share',
    header: '% of Total',
    // Share is derived from total — sorting by it would duplicate sorting by total.
    enableSorting: false,
    cell: renderShareCell,
    meta: {
      thClassName: cn('th-class', 'text-right'),
      tdClassName: 'px-4 py-3 text-right',
    },
  },
];

export function ExpenseCategoryBreakdown({
  year,
  monthFilter,
}: {
  readonly year: number;
  readonly monthFilter: number | null;
}) {
  const { data, isPending, isError } = useExpenseCategories(year);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);

  // Reset to all-expanded whenever the visible data set changes.
  useEffect(() => {
    setExpanded(true);
  }, [year, monthFilter]);

  const treeData = useMemo(
    () => buildCategoryTree(data?.rows ?? [], monthFilter),
    [data, monthFilter]
  );

  // True when all rows are expanded globally, or at least one is explicitly expanded.
  // Used to decide whether the toggle button should offer "Collapse All" or "Expand All".
  const hasAnyExpanded =
    expanded === true || Object.values(expanded).some(Boolean);

  const table = useReactTable({
    data: treeData,
    columns: CATEGORY_COLUMNS,
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
            onClick={() => setExpanded(hasAnyExpanded ? {} : true)}
            className="text-xs text-content-muted hover:text-content-primary transition-colors"
          >
            {hasAnyExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}
      </div>

      {isPending && <SkeletonTable columns={3} rows={CATEGORY_SKELETON_ROWS} />}
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
                        cursor: header.column.getCanSort()
                          ? 'pointer'
                          : 'default',
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
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
