import React, { useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionFilters, type FilterState } from '../components/TransactionFilters';
import { TransactionReviewPanel } from '../components/TransactionReviewPanel';
import { TransactionTagsPanel } from '../components/TransactionTagsPanel';
import { PageLayout } from '../components/PageLayout';

const DEFAULT_FILTERS: FilterState = {
  accountId: '',
  startDate: '',
  endDate: '',
  categoryId: '',
  flaggedOnly: false,
};

function formatAmount(amount: string, _isIncome: boolean): string {
  const num = parseFloat(amount);
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(Math.abs(num));
  return num < 0 ? `-${formatted}` : `+${formatted}`;
}

export function TransactionsPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Reset to page 1 when filters change
  function handleFilterChange(newFilters: FilterState) {
    setFilters(newFilters);
    setPage(1);
  }

  const { data, isLoading, isError } = useTransactions({
    accountId: filters.accountId || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    categoryId: filters.categoryId || undefined,
    flagged: filters.flaggedOnly || undefined,
    page,
  });

  const transactions = data?.data ?? [];
  const pagination = data?.pagination;
  const flaggedCount = transactions.filter(t => t.flaggedForReview).length;

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Transactions</h1>
          {pagination && (
            <p className="text-sm text-gray-400 mt-0.5">{pagination.total} total</p>
          )}
        </div>
        {flaggedCount > 0 && (
          <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            {flaggedCount} need{flaggedCount === 1 ? 's' : ''} review
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4">
        <TransactionFilters filters={filters} onChange={handleFilterChange} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">Failed to load transactions.</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No transactions found.</p>
          <p className="text-sm mt-1">Try adjusting your filters or import a CSV file.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(tx => (
                <React.Fragment key={tx.id}>
                  <tr
                    className={`hover:bg-gray-50 ${
                      tx.flaggedForReview && !tx.isTransfer ? 'bg-amber-50' : ''
                    } ${tx.isTransfer ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div>
                          <p className="text-sm text-gray-900 truncate max-w-xs">
                            {tx.sourceName ?? tx.description}
                            {tx.isTransfer && (
                              <span className="ml-1.5 text-xs text-gray-400">(transfer)</span>
                            )}
                          </p>
                          {tx.note && (
                            <p className="text-xs text-gray-400 mt-0.5">{tx.note}</p>
                          )}
                        </div>
                        {tx.flaggedForReview && !tx.isTransfer && (
                          <button
                            onClick={() => setReviewingId(reviewingId === tx.id ? null : tx.id)}
                            className="shrink-0 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                          >
                            {reviewingId === tx.id ? 'Close' : 'Review'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <span>{tx.categoryName ?? '—'}</span>
                        {tx.needWant && tx.needWant !== 'NA' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            tx.needWant === 'Need'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {tx.needWant}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TransactionTagsPanel
                        transactionId={tx.id}
                        attachedTags={tx.tags}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{tx.accountName}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono text-sm font-medium ${
                        tx.isTransfer
                          ? 'text-gray-400'
                          : parseFloat(tx.amount) > 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {formatAmount(tx.amount, tx.isIncome)}
                      </span>
                    </td>
                  </tr>

                  {/* Inline review panel */}
                  {reviewingId === tx.id && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <TransactionReviewPanel
                          transaction={tx}
                          onClose={() => setReviewingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}