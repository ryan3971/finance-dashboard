import {
  type FilterState,
  TransactionFilters,
} from '@/features/transactions/components/filters/TransactionFilters';
import {
  ManualTransactionPanel,
  type ManualTransactionInitialValues,
} from '@/features/transactions/components/panels/ManualTransactionPanel';
import { TransactionsTable } from '@/features/transactions/components/table/TransactionsTable';
import { type ExpandedPanel } from '@/features/transactions/hooks/useTransactionColumns';
import {
  type Transaction,
  useTransactions,
} from '@/features/transactions/hooks/useTransactions';
import { useDeleteTransaction } from '@/features/transactions/hooks/useTransactionMutations';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { parseAmount } from '@/lib/utils';
import { useCallback, useState } from 'react';

interface PresetFilters {
  isIncome?: boolean;
}

interface TransactionTablePaneProps {
  readonly presetFilters?: PresetFilters;
  readonly defaultFilters?: Partial<FilterState>;
  readonly className?: string;
}

const EMPTY_FILTER_STATE: FilterState = {
  accountId: '',
  startDate: '',
  endDate: '',
  categoryId: '',
  subcategoryId: '',
  flaggedOnly: false,
};

const SKELETON_ROW_COUNT = 6;

function PaneSkeleton() {
  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="flex justify-end px-3 py-2 border-b border-border-subtle">
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => `skeleton-${i}`).map((id) => (
          <div key={id} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionTablePane({
  presetFilters,
  defaultFilters,
  className,
}: TransactionTablePaneProps) {
  const [filters, setFilters] = useState<FilterState>({
    ...EMPTY_FILTER_STATE,
    ...defaultFilters,
  });
  const [page, setPage] = useState(1);
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelInitialValues, setPanelInitialValues] =
    useState<ManualTransactionInitialValues | undefined>();

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

  function handleFilterChange(newFilters: FilterState) {
    setFilters(newFilters);
    setPage(1);
    setExpandedPanel(null);
  }

  const { data, isLoading, isError } = useTransactions({
    accountId: filters.accountId || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    categoryId: filters.categoryId || undefined,
    subcategoryId: filters.subcategoryId || undefined,
    flagged: filters.flaggedOnly || undefined,
    isIncome: presetFilters?.isIncome,
    page,
  });

  const transactions = data?.data ?? [];
  const pagination = data?.pagination;

  let tableContent: React.ReactNode;
  if (isLoading) {
    tableContent = <PaneSkeleton />;
  } else if (isError) {
    tableContent = (
      <EmptyState message="Failed to load transactions." variant="error" />
    );
  } else if (transactions.length === 0) {
    tableContent = (
      <EmptyState
        message="No transactions found."
        hint="Try adjusting your filters."
      />
    );
  } else {
    tableContent = (
      <TransactionsTable
        transactions={transactions}
        expandedPanel={expandedPanel}
        onExpand={handlePanelToggle}
        onCollapse={handleCollapse}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteRequest}
        pagination={pagination}
        onPageChange={setPage}
      />
    );
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <TransactionFilters filters={filters} onChange={handleFilterChange} />
      </div>

      {tableContent}

      {panelOpen && (
        <ManualTransactionPanel
          initialValues={panelInitialValues}
          onClose={handleClosePanel}
        />
      )}

      <Dialog
        open={deletingId !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setDeletingId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete transaction?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" size="md" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="warning"
              size="md"
              disabled={deleteTransaction.isPending}
              onClick={() => {
                void handleDeleteConfirm();
              }}
            >
              {deleteTransaction.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
