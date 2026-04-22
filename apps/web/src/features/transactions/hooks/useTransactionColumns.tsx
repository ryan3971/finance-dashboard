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
import { TransactionTagsPanel } from '@/features/transactions/components/panels/TransactionTagsPanel';
import { Badge } from '@/components/ui/Badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import type { ColumnDef } from '@tanstack/react-table';
import type { Transaction } from '@finance/shared/schemas/transactions';
import { parseAmount } from '@/lib/utils';
import { useMemo } from 'react';
import type { ExpandedPanel } from '@/features/transactions/types/panels';

export const ACTIONS_COLUMN_ID = 'actions';

export function isTransactionReviewable(tx: Transaction): boolean {
  return tx.flaggedForReview && !tx.isTransfer;
}

// SortIcon is an unexported internal helper used only in column header cells.
// This file intentionally mixes a component with non-component exports (hook,
// constant, utility fn), so fast refresh won't work here — that's acceptable
// for a hooks file where HMR on the component itself has no practical value.
// eslint-disable-next-line react-refresh/only-export-components
function SortIcon({ sorted }: { readonly sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="ml-1 inline h-3 w-3" />;
  if (sorted === 'desc') return <ChevronDown className="ml-1 inline h-3 w-3" />;
  return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
}

interface UseTransactionColumnsOptions {
  expandedPanel: ExpandedPanel | null;
  onReviewToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onRebalancing: (tx: Transaction) => void;
}

export function useTransactionColumns({
  expandedPanel,
  onReviewToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onRebalancing,
}: UseTransactionColumnsOptions): ColumnDef<Transaction>[] {
  return useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        id: 'date',
        accessorKey: 'date',
        meta: {
          label: 'Date',
          colWidth: 'w-24',
          tdClassName: 'td-cell whitespace-nowrap',
        },
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
        meta: {
          label: 'Description',
          colWidth: 'w-auto min-w-40',
          tdClassName: 'px-4 py-3',
          truncate: true,
        },
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
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="truncate text-sm text-content-primary"
                  title={tx.sourceName ?? tx.description}
                >
                  {tx.sourceName ?? tx.description}
                  {tx.isTransfer && (
                    <span className="ml-1.5 text-xs text-content-muted">
                      (transfer)
                    </span>
                  )}
                </span>
                {tx.rebalancingGroupId !== null && (
                  <Badge variant="neutral" rounded="sm" className="shrink-0">
                    {tx.rebalancingRole === 'source' ? 'Source' : 'Offset'}
                  </Badge>
                )}
              </div>
              {tx.note && (
                <span
                  className="block truncate text-xs text-content-muted mt-0.5"
                  title={tx.note}
                >
                  {tx.note}
                </span>
              )}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'category',
        accessorKey: 'categoryName',
        meta: {
          label: 'Category',
          colWidth: 'min-w-36 w-48',
          truncate: true,
        },
        header: () => 'Category',
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="block truncate"
                title={tx.categoryName ?? undefined}
              >
                {tx.categoryName ?? '—'}
              </span>
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
        id: 'subcategory',
        accessorKey: 'subcategoryName',
        meta: {
          label: 'Subcategory',
          colWidth: 'w-36',
          truncate: true,
        },
        header: () => 'Subcategory',
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <span
              className="block truncate"
              title={tx.subcategoryName ?? undefined}
            >
              {tx.subcategoryName ?? '—'}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: 'tags',
        meta: {
          label: 'Tags',
          colWidth: 'w-40',
          thClassName: 'th-cell',
          tdClassName: 'px-4 py-3',
        },
        header: () => 'Tags',
        cell: ({ row }) => {
          const tx = row.original;
          const visible = tx.tags.slice(0, 2);
          const overflow = tx.tags.length - visible.length;
          return (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="group flex items-center gap-1 overflow-hidden w-full text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  {tx.tags.length === 0 ? (
                    <span className="text-xs text-content-muted border border-dashed border-border-strong rounded px-1.5 py-0.5">
                      + tag
                    </span>
                  ) : (
                    <>
                      {visible.map((tag) => (
                        <span
                          key={tag.id}
                          className="max-w-[4.5rem] truncate rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: tag.color ?? '#6B7280' }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {overflow > 0 && (
                        <span className="shrink-0 text-xs text-content-muted">
                          +{overflow}
                        </span>
                      )}
                      <span className="shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs text-content-muted border border-dashed border-border-strong rounded px-1 py-0.5">
                        +
                      </span>
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80"
                align="start"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <TransactionTagsPanel
                  transactionId={tx.id}
                  attachedTags={tx.tags}
                />
              </PopoverContent>
            </Popover>
          );
        },
        enableSorting: false,
      },
      {
        id: 'account',
        accessorKey: 'accountName',
        meta: {
          label: 'Account',
          colWidth: 'min-w-32 w-36',
          thClassName: 'th-cell',
          tdClassName: 'td-cell',
          truncate: true,
        },
        header: () => 'Account',
        cell: ({ row }) => (
          <span
            className="block truncate"
            title={row.original.accountName ?? undefined}
          >
            {row.original.accountName}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: 'amount',
        accessorKey: 'amount',
        meta: {
          label: 'Amount',
          colWidth: 'w-32',
          tdClassName: 'px-4 py-3 text-right',
        },
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
          parseAmount(a.original.amount) - parseAmount(b.original.amount),
      },
      {
        id: ACTIONS_COLUMN_ID,
        meta: {
          label: 'Actions',
          colWidth: 'w-10',
          thClassName: 'th-cell w-10',
          tdClassName: 'px-2 py-3 text-right',
        },
        header: () => null,
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <DropdownMenu>
              {/* stopPropagation prevents the row-level onClick (detail panel) from firing when the menu is used */}
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 rounded text-content-muted hover:bg-surface-muted hover:text-content-primary focus:outline-none"
                  aria-label="Row actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                {isTransactionReviewable(tx) && (
                  <>
                    <DropdownMenuItem onClick={() => onReviewToggle(tx.id)}>
                      {expandedPanel?.id === tx.id &&
                      expandedPanel.mode === 'review'
                        ? 'Close review'
                        : 'Review'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {!isTransactionReviewable(tx) && (
                  <DropdownMenuItem onClick={() => onEdit(tx.id)}>
                    {expandedPanel?.id === tx.id &&
                    expandedPanel.mode === 'edit'
                      ? 'Close edit'
                      : 'Edit'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onDuplicate(tx)}>
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onRebalancing(tx)}>
                  {tx.rebalancingGroupId === null
                    ? 'Add to group'
                    : 'Manage group'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(tx.id)}
                  className="text-danger"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    [
      expandedPanel,
      onReviewToggle,
      onEdit,
      onDuplicate,
      onDelete,
      onRebalancing,
    ]
  );
}
