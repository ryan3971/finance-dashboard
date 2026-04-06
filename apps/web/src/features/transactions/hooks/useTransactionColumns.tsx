
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { AmountCell } from '@/features/transactions/components/table/AmountCell';
import { Badge } from '@/components/ui/Badge';
import type { ColumnDef } from '@tanstack/react-table';
import type { Transaction } from '@/features/transactions/hooks/useTransactions';
import { TransactionTagsPanel } from '@/features/transactions/components/panels/TransactionTagsPanel';
import { useMemo } from 'react';

export const ACTIONS_COLUMN_ID = 'actions';

export function isTransactionReviewable(tx: Transaction): boolean {
  return tx.flaggedForReview && !tx.isTransfer;
}

// SortIcon is an unexported internal helper used only in column header cells.
// This file intentionally mixes a component with non-component exports (hook,
// constant, utility fn), so fast refresh won't work here — that's acceptable
// for a hooks file where HMR on the component itself has no practical value.
// eslint-disable-next-line react-refresh/only-export-components
function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="ml-1 inline h-3 w-3" />;
  if (sorted === 'desc') return <ChevronDown className="ml-1 inline h-3 w-3" />;
  return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
}

interface UseTransactionColumnsOptions {
  reviewingId: string | null;
  onReviewToggle: (id: string) => void;
}

export function useTransactionColumns({
  reviewingId,
  onReviewToggle,
}: UseTransactionColumnsOptions): ColumnDef<Transaction>[] {
  return useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        id: 'date',
        accessorKey: 'date',
        meta: { label: 'Date', tdClassName: 'td-cell whitespace-nowrap' },
        header: ({ column }) => (
          <button
            className="flex items-center hover:text-content-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Date
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => row.original.date,
        enableSorting: true,
      },
      {
        id: 'description',
        accessorKey: 'description',
        meta: { label: 'Description', tdClassName: 'px-4 py-3' },
        header: ({ column }) => (
          <button
            className="flex items-center hover:text-content-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Description
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <div>
              <p className="text-sm text-content-primary truncate max-w-xs">
                {tx.sourceName ?? tx.description}
                {tx.isTransfer && (
                  <span className="ml-1.5 text-xs text-content-muted">
                    (transfer)
                  </span>
                )}
              </p>
              {tx.note && (
                <p className="text-xs text-content-muted mt-0.5">{tx.note}</p>
              )}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'category',
        accessorKey: 'categoryName',
        meta: { label: 'Category' },
        header: () => 'Category',
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <div className="flex items-center gap-1.5">
              <span>{tx.categoryName ?? '—'}</span>
              {tx.needWant && tx.needWant !== 'NA' && (
                <Badge variant={tx.needWant === 'Need' ? 'info' : 'accent'}>
                  {tx.needWant}
                </Badge>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'tags',
        meta: { label: 'Tags', tdClassName: 'px-4 py-3 max-w-xs' },
        header: () => 'Tags',
        cell: ({ row }) => (
          <TransactionTagsPanel
            transactionId={row.original.id}
            attachedTags={row.original.tags}
          />
        ),
        enableSorting: false,
      },
      {
        id: 'account',
        accessorKey: 'accountName',
        meta: { label: 'Account' },
        header: () => 'Account',
        cell: ({ row }) => row.original.accountName,
        enableSorting: false,
      },
      {
        id: 'amount',
        accessorKey: 'amount',
        meta: { label: 'Amount', tdClassName: 'px-4 py-3 text-right' },
        header: ({ column }) => (
          <button
            className="flex w-full items-center justify-end hover:text-content-primary"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Amount
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <AmountCell
            amount={row.original.amount}
            isTransfer={row.original.isTransfer}
          />
        ),
        enableSorting: true,
        sortingFn: (a, b) =>
          parseFloat(a.original.amount) - parseFloat(b.original.amount),
      },
      {
        id: ACTIONS_COLUMN_ID,
        meta: {
          label: 'Actions',
          thClassName: 'th-cell w-10',
          tdClassName: 'px-2 py-3 text-right',
        },
        header: () => null,
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded p-1 text-content-muted hover:bg-surface-muted hover:text-content-primary focus:outline-none"
                  aria-label="Row actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isTransactionReviewable(tx) && (
                  <>
                    <DropdownMenuItem onClick={() => onReviewToggle(tx.id)}>
                      {reviewingId === tx.id ? 'Close review' : 'Review'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem disabled>
                  Duplicate
                  <span className="ml-auto text-xs text-content-muted">
                    Soon
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    [reviewingId, onReviewToggle]
  );
}
