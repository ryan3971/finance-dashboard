import {
  isTransactionReviewable,
  useTransactionColumns,
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
import { Pagination } from '@/components/common/Pagination';
import type {
  PaginationInfo,
  Transaction,
} from '@/features/transactions/hooks/useTransactions';
import { TransactionReviewPanel } from '@/features/transactions/components/panels/TransactionReviewPanel';

const UNKNOWN_PAGE_COUNT = -1;

interface TransactionsTableProps {
  readonly transactions: Transaction[];
  readonly reviewingId: string | null;
  readonly onReviewToggle: (id: string) => void;
  readonly onDuplicate: (tx: Transaction) => void;
  readonly pagination?: PaginationInfo;
  readonly onPageChange: (page: number) => void;
}

export function TransactionsTable({
  transactions,
  reviewingId,
  onReviewToggle,
  onDuplicate,
  pagination,
  onPageChange,
}: TransactionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const columns = useTransactionColumns({
    reviewingId,
    onReviewToggle,
    onDuplicate,
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

  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="flex justify-end px-3 py-2 border-b border-border-subtle">
        <ColumnVisibilityToggle table={table} />
      </div>

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

                {reviewingId === row.original.id && (
                  <tr>
                    <td colSpan={visibleColumnCount} className="p-0">
                      <TransactionReviewPanel
                        transaction={row.original}
                        onClose={() => onReviewToggle(row.original.id)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPrev={() => onPageChange(pagination.page - 1)}
          onNext={() => onPageChange(pagination.page + 1)}
        />
      )}
    </div>
  );
}
