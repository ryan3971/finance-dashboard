import {
  type FilterState,
  TransactionFilters,
} from '@/features/transactions/components/filters/TransactionFilters';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { TransactionsTable } from '@/features/transactions/components/table/TransactionsTable';
import { useState } from 'react';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';

function TransactionsSkeleton() {
  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="flex justify-end px-3 py-2 border-b border-border-subtle">
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionsPage() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const filters: FilterState = {
    accountId: search.accountId ?? '',
    startDate: search.startDate ?? '',
    endDate: search.endDate ?? '',
    categoryId: search.categoryId ?? '',
    flaggedOnly: search.flaggedOnly ?? false,
  };
  const page = search.page ?? 1;

  function handleFilterChange(newFilters: FilterState) {
    void navigate({
      search: {
        accountId: newFilters.accountId || undefined,
        startDate: newFilters.startDate || undefined,
        endDate: newFilters.endDate || undefined,
        categoryId: newFilters.categoryId || undefined,
        flaggedOnly: newFilters.flaggedOnly || undefined,
        page: undefined,
      },
    });
  }

  function handlePageChange(newPage: number) {
    void navigate({ search: (prev) => ({ ...prev, page: newPage }) });
  }

  function handleReviewToggle(id: string) {
    setReviewingId((prev) => (prev === id ? null : id));
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
  const flaggedCount = transactions.filter((t) => t.flaggedForReview).length;

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">
            Transactions
          </h1>
          {pagination && (
            <p className="text-sm text-content-muted mt-0.5">
              {pagination.total} total
            </p>
          )}
        </div>
        {flaggedCount > 0 && (
          <Badge variant="warning" rounded="full" className="px-3 py-1 text-sm">
            {flaggedCount} need{flaggedCount === 1 ? 's' : ''} review
          </Badge>
        )}
      </div>

      <div className="mb-4">
        <TransactionFilters filters={filters} onChange={handleFilterChange} />
      </div>

      {isLoading ? (
        <TransactionsSkeleton />
      ) : isError ? (
        <EmptyState message="Failed to load transactions." variant="error" />
      ) : transactions.length === 0 ? (
        <EmptyState
          message="No transactions found."
          hint="Try adjusting your filters or import a CSV file."
        />
      ) : (
        <TransactionsTable
          transactions={transactions}
          reviewingId={reviewingId}
          onReviewToggle={handleReviewToggle}
          pagination={pagination}
          onPageChange={handlePageChange}
        />
      )}
    </PageLayout>
  );
}
