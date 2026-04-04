import { DEFAULT_CURRENCY } from '@finance/shared';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import React from 'react';
import type { Transaction } from '@/hooks/useTransactions';
import { TransactionReviewPanel } from '@/features/transactions/TransactionReviewPanel';
import { TransactionTagsPanel } from '@/features/transactions/TransactionTagsPanel';

interface PaginationInfo {
  page: number;
  totalPages: number;
  total: number;
}

interface TransactionsTableProps {
  transactions: Transaction[];
  reviewingId: string | null;
  onReviewToggle: (id: string) => void;
  pagination?: PaginationInfo;
  onPageChange: (page: number) => void;
}

function formatAmount(amount: string): string {
  const num = parseFloat(amount);
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
  }).format(Math.abs(num));
  return num < 0 ? `-${formatted}` : `+${formatted}`;
}

export function TransactionsTable({
  transactions,
  reviewingId,
  onReviewToggle,
  pagination,
  onPageChange,
}: TransactionsTableProps) {
  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <table className="min-w-full divide-y divide-border-subtle">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="th-cell">Date</th>
            <th className="th-cell">Description</th>
            <th className="th-cell">Category</th>
            <th className="th-cell">Tags</th>
            <th className="th-cell">Account</th>
            <th className="th-cell text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {transactions.map((tx) => (
            <React.Fragment key={tx.id}>
              <tr
                className={`hover:bg-surface-subtle ${
                  tx.flaggedForReview && !tx.isTransfer ? 'bg-warning-bg' : ''
                } ${tx.isTransfer ? 'opacity-60' : ''}`}
              >
                <td className="td-cell whitespace-nowrap">{tx.date}</td>
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div>
                      <p className="text-sm text-content-primary truncate max-w-xs">
                        {tx.sourceName ?? tx.description}
                        {tx.isTransfer && (
                          <span className="ml-1.5 text-xs text-content-muted">(transfer)</span>
                        )}
                      </p>
                      {tx.note && (
                        <p className="text-xs text-content-muted mt-0.5">{tx.note}</p>
                      )}
                    </div>
                    {tx.flaggedForReview && !tx.isTransfer && (
                      <button
                        onClick={() => onReviewToggle(tx.id)}
                        className="shrink-0 text-xs px-2 py-0.5 bg-warning-subtle text-warning rounded hover:bg-amber-200 transition-colors"
                      >
                        {reviewingId === tx.id ? 'Close' : 'Review'}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-content-secondary">
                  <div className="flex items-center gap-1.5">
                    <span>{tx.categoryName ?? '—'}</span>
                    {tx.needWant && tx.needWant !== 'NA' && (
                      <Badge variant={tx.needWant === 'Need' ? 'info' : 'accent'}>
                        {tx.needWant}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <TransactionTagsPanel
                    transactionId={tx.id}
                    attachedTags={tx.tags}
                  />
                </td>
                <td className="td-cell">{tx.accountName}</td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`font-mono text-sm font-medium ${
                      tx.isTransfer
                        ? 'text-content-muted'
                        : parseFloat(tx.amount) > 0
                          ? 'text-positive'
                          : 'text-danger'
                    }`}
                  >
                    {formatAmount(tx.amount)}
                  </span>
                </td>
              </tr>

              {reviewingId === tx.id && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <TransactionReviewPanel
                      transaction={tx}
                      onClose={() => onReviewToggle(tx.id)}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
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

