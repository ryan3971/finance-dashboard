import {
  type FilterState,
  TransactionFilters,
} from '@/features/transactions/components/filters/TransactionFilters';
import { triggerCsvDownload } from '@/features/transactions/utils/exportCsv';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ManualTransactionPanel } from '@/features/transactions/components/panels/ManualTransactionPanel';
import type { ManualTransactionInitialValues } from '@/features/transactions/components/panels/ManualTransactionPanel';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Transaction } from '@/features/transactions/hooks/useTransactions';
import { TransactionsTable } from '@/features/transactions/components/table/TransactionsTable';
import { useCallback, useState } from 'react';
import { useDeleteTransaction } from '@/features/transactions/hooks/useTransactionMutations';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import api from '@/lib/api';
import { parseAmount } from '@/lib/utils';
import { PAGINATION } from '@finance/shared/constants';
import type { ExpandedPanel } from '@/features/transactions/hooks/useTransactionColumns';

const TRANSACTION_SKELETON_ROW_COUNT = 8;

function TransactionsSkeleton() {
  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="flex justify-end px-3 py-2 border-b border-border-subtle">
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: TRANSACTION_SKELETON_ROW_COUNT }, (_, i) => `skeleton-${i}`).map((id) => (
          <div key={id} className="flex items-center gap-4 px-4 py-3">
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
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelInitialValues, setPanelInitialValues] =
    useState<ManualTransactionInitialValues>();
  const [isExporting, setIsExporting] = useState(false);

  const filters: FilterState = {
    accountId: search.accountId ?? '',
    startDate: search.startDate ?? '',
    endDate: search.endDate ?? '',
    categoryId: search.categoryId ?? '',
    subcategoryId: search.subcategoryId ?? '',
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
        subcategoryId: newFilters.subcategoryId || undefined,
        flaggedOnly: newFilters.flaggedOnly || undefined,
        page: undefined,
      },
    });
  }

  function handlePageChange(newPage: number) {
    void navigate({ search: (prev) => ({ ...prev, page: newPage }) });
  }

  const deleteTransaction = useDeleteTransaction();

  const handlePanelToggle = useCallback((id: string, mode: 'review' | 'edit') => {
    setExpandedPanel((prev) =>
      prev?.id === id && prev.mode === mode ? null : { id, mode }
    );
  }, []);

  const handleCollapse = useCallback(() => setExpandedPanel(null), []);

  const handleDeleteRequest = useCallback((id: string) => setDeletingId(id), []);

  async function handleDeleteConfirm() {
    if (!deletingId) return;
    await deleteTransaction.mutateAsync(deletingId);
    setDeletingId(null);
  }

  const handleDuplicate = useCallback((tx: Transaction) => {
    setPanelInitialValues({
      accountId: tx.accountId,
      description: tx.sourceName ?? tx.description,
      amount: parseAmount(tx.amount),
      categoryId: tx.categoryId ?? undefined,
      subcategoryId: tx.subcategoryId ?? undefined,
      needWant: tx.needWant ?? undefined,
      note: tx.note ?? undefined,
      tagIds: tx.tags.map((t) => t.id),
    });
    setPanelOpen(true);
  }, []);

  function handleClosePanel() {
    setPanelOpen(false);
    setPanelInitialValues(undefined);
  }

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const { data: result } = await api.get<{ data: Transaction[] }>(
        '/transactions',
        {
          params: {
            accountId: filters.accountId || undefined,
            startDate: filters.startDate || undefined,
            endDate: filters.endDate || undefined,
            categoryId: filters.categoryId || undefined,
            subcategoryId: filters.subcategoryId || undefined,
            flagged: filters.flaggedOnly || undefined,
            limit: PAGINATION.EXPORT_LIMIT,
          },
        }
      );
      triggerCsvDownload(result.data, filters);
    } finally {
      setIsExporting(false);
    }
  }

  const { data, isLoading, isError } = useTransactions({
    accountId: filters.accountId || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    categoryId: filters.categoryId || undefined,
    subcategoryId: filters.subcategoryId || undefined,
    flagged: filters.flaggedOnly || undefined,
    page,
  });

  const transactions = data?.data ?? [];
  const pagination = data?.pagination;
  const flaggedCount = transactions.filter((t) => t.flaggedForReview).length;

  let content: React.ReactNode;
  if (isLoading) {
    content = <TransactionsSkeleton />;
  } else if (isError) {
    content = (
      <EmptyState message="Failed to load transactions." variant="error" />
    );
  } else if (transactions.length === 0) {
    content = (
      <EmptyState
        message="No transactions found."
        hint="Try adjusting your filters or import a CSV file."
      />
    );
  } else {
    content = (
      <TransactionsTable
        transactions={transactions}
        expandedPanel={expandedPanel}
        onExpand={handlePanelToggle}
        onCollapse={handleCollapse}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteRequest}
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    );
  }

  return (
    <PageLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
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
        <div className="flex flex-wrap items-center gap-2">
          {flaggedCount > 0 && (
            <Badge
              variant="warning"
              rounded="full"
              className="px-3 py-1 text-sm"
            >
              {flaggedCount} need{flaggedCount === 1 ? 's' : ''} review
            </Badge>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={isExporting}
            onClick={() => void handleExportCsv()}
          >
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button size="sm" onClick={() => setPanelOpen(true)}>
            Add Transaction
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <TransactionFilters filters={filters} onChange={handleFilterChange} />
      </div>
      {content}
      {panelOpen && (
        <ManualTransactionPanel
          initialValues={panelInitialValues}
          onClose={handleClosePanel}
        />
      )}

      <Dialog open={deletingId !== null} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete transaction?</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" size="md" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="warning"
              size="md"
              disabled={deleteTransaction.isPending}
              onClick={() => { void handleDeleteConfirm(); }}
            >
              {deleteTransaction.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
