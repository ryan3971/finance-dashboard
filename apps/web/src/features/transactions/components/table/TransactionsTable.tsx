import {
  isTransactionReviewable,
  useTransactionColumns,
  type ExpandedPanel,
} from '@/features/transactions/hooks/useTransactionColumns';
import { Fragment, useMemo, useState } from 'react';
import {
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { ColumnVisibilityToggle } from '@/features/transactions/components/table/ColumnVisibilityToggle';
import { flexRender } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/common/Pagination';
import type {
  PaginationInfo,
  Transaction,
} from '@/features/transactions/hooks/useTransactions';
import { TransactionReviewPanel } from '@/features/transactions/components/panels/TransactionReviewPanel';

const UNKNOWN_PAGE_COUNT = -1;

interface TransactionsTableProps {
  readonly transactions: Transaction[];
  readonly expandedPanel: ExpandedPanel | null;
  readonly onExpand: (id: string, mode: 'review' | 'edit') => void;
  readonly onCollapse: () => void;
  readonly onDuplicate: (tx: Transaction) => void;
  readonly onDelete: (id: string) => void;
  readonly pagination?: PaginationInfo;
  readonly onPageChange: (page: number) => void;
}

export function TransactionsTable({
  transactions,
  expandedPanel,
  onExpand,
  onCollapse,
  onDuplicate,
  onDelete,
  pagination,
  onPageChange,
}: TransactionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const columns = useTransactionColumns({
    expandedPanel,
    onReviewToggle: (id) => onExpand(id, 'review'),
    onEdit: (id) => onExpand(id, 'edit'),
    onDuplicate,
    onDelete,
  });

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: pagination?.totalPages ?? UNKNOWN_PAGE_COUNT,
  });

  const visibleColumnCount = useMemo(
    () => table.getAllColumns().filter((col) => col.getIsVisible()).length,
    // `table` is a new reference every render, so listing it would defeat memoization.
    // `columnVisibility` is the actual state that drives getIsVisible(), so it's the correct dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnVisibility]
  );

  const paginationNode = pagination && pagination.totalPages > 1 ? (
    <Pagination
      page={pagination.page}
      totalPages={pagination.totalPages}
      onPrev={() => onPageChange(pagination.page - 1)}
      onNext={() => onPageChange(pagination.page + 1)}
    />
  ) : null;

  return (
    <DataTable toolbar={<ColumnVisibilityToggle table={table} />} footer={paginationNode}>
      <table className="min-w-full divide-y divide-border-subtle">
        <thead className="bg-surface-subtle">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={
                    header.column.columnDef.meta?.thClassName ?? 'th-cell'
                  }
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {table.getRowModel().rows.map((row) => {
            const reviewable = isTransactionReviewable(row.original);
            return (
              <Fragment key={row.id}>
                <tr
                  className={`hover:bg-surface-subtle ${
                    reviewable ? 'bg-warning-bg' : ''
                  } ${row.original.isTransfer ? 'opacity-60' : ''}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={
                        cell.column.columnDef.meta?.tdClassName ?? 'td-cell'
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>

                {expandedPanel?.id === row.original.id && (
                  <tr>
                    <td colSpan={visibleColumnCount} className="p-0">
                      <TransactionReviewPanel
                        transaction={row.original}
                        mode={expandedPanel.mode}
                        onClose={onCollapse}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </DataTable>
  );
}
