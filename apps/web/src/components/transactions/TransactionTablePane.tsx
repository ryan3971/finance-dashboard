import {
  EMPTY_FILTER_STATE,
  type FilterState,
} from '@/features/transactions/components/filters/filterState';
import { TransactionFilters } from '@/features/transactions/components/filters/TransactionFilters';

import {
  ManualTransactionPanel,
  type ManualTransactionInitialValues,
} from '@/features/transactions/components/panels/ManualTransactionPanel';
import { TransactionsTable } from '@/features/transactions/components/table/TransactionsTable';
import type { ExpandedPanel } from '@/features/transactions/types/panels';
import {
  type PaginationInfo,
  type Transaction,
  useTransactions,
} from '@/features/transactions/hooks/useTransactions';
import { useDeleteTransaction } from '@/features/transactions/hooks/useTransactionMutations';
import type { TransactionFilters as TransactionFilterParams } from '@finance/shared/schemas/transactions';
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
import { useCallback, useEffect, useRef, useState } from 'react';

interface TransactionTablePaneProps {
  // Server-side filters always applied, not exposed in the filter UI
  readonly presetFilters?: Partial<TransactionFilterParams>;
  // Initial values for user-editable filters (uncontrolled mode only)
  readonly defaultFilters?: Partial<FilterState>;
  readonly className?: string;
  // Controlled mode: parent owns filter state (e.g. URL-driven)
  readonly filterState?: FilterState;
  readonly onFilterChange?: (filters: FilterState) => void;
  // Controlled mode: parent owns page state
  readonly page?: number;
  readonly onPageChange?: (page: number) => void;
  // Fired after each data fetch — parent can use for header stats
  readonly onDataLoad?: (
    pagination: PaginationInfo | undefined,
    flaggedCount: number
  ) => void;
  // Fired when the user selects "Add to group" / "Manage group" on a row
  readonly onRebalancing?: (tx: Transaction) => void;
}

const SKELETON_ROW_COUNT = 6;

function PaneSkeleton() {
  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="flex justify-end px-3 py-2 border-b border-border-subtle">
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="divide-y divide-border-subtle">
        {Array.from(
          { length: SKELETON_ROW_COUNT },
          (_, i) => `skeleton-${i}`
        ).map((id) => (
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
  filterState,
  onFilterChange,
  page,
  onPageChange,
  onDataLoad,
  onRebalancing,
}: TransactionTablePaneProps) {
  const isFilterControlled = filterState !== undefined;
  const isPageControlled = page !== undefined;

  // Captured once at mount — this is what "Clear all" in the filter panel
  // resets to, preserving any baseline values set by defaultFilters (e.g.
  // a year's date range from ExpensesPage).
  const [resetFilters] = useState<FilterState>({
    ...EMPTY_FILTER_STATE,
    ...defaultFilters,
  });
  const [localFilters, setLocalFilters] = useState<FilterState>(resetFilters);
  const [localPage, setLocalPage] = useState(1);
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelInitialValues, setPanelInitialValues] = useState<
    ManualTransactionInitialValues | undefined
  >();

  const activeFilters = isFilterControlled ? filterState : localFilters;
  const activePage = isPageControlled ? page : localPage;

  const deleteTransaction = useDeleteTransaction();

  const handlePanelToggle = useCallback(
    (id: string, mode: ExpandedPanel['mode']) => {
      setExpandedPanel((prev) =>
        prev?.id === id && prev.mode === mode ? null : { id, mode }
      );
    },
    []
  );

  const handleCollapse = useCallback(() => setExpandedPanel(null), []);
  const handleDeleteRequest = useCallback(
    (id: string) => setDeletingId(id),
    []
  );

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
    if (isFilterControlled) {
      onFilterChange?.(newFilters);
    } else {
      setLocalFilters(newFilters);
      if (!isPageControlled) setLocalPage(1);
      // Notify parent even in uncontrolled mode so it can react to filter
      // changes (e.g. ExpensesPage clearing its month selection when the
      // date range is overridden by the user).
      onFilterChange?.(newFilters);
    }
    setExpandedPanel(null);
  }

  function handlePageChange(newPage: number) {
    if (isPageControlled) {
      onPageChange?.(newPage);
    } else {
      setLocalPage(newPage);
    }
    setExpandedPanel(null);
  }

  const { data, isLoading, isError } = useTransactions({
    accountId: activeFilters.accountId || undefined,
    startDate: activeFilters.startDate || undefined,
    endDate: activeFilters.endDate || undefined,
    categoryId: activeFilters.categoryId || undefined,
    subcategoryId: activeFilters.subcategoryId || undefined,
    flagged: activeFilters.flaggedOnly || undefined,
    // presetFilters always win — spread last so they override user-editable fields
    ...presetFilters,
    page: activePage,
  });

  // Stable ref so the effect doesn't need onDataLoad as a dependency
  const onDataLoadRef = useRef(onDataLoad);
  useEffect(() => {
    onDataLoadRef.current = onDataLoad;
  });
  useEffect(() => {
    const flaggedCount = (data?.data ?? []).filter(
      (t) => t.flaggedForReview
    ).length;
    onDataLoadRef.current?.(data?.pagination, flaggedCount);
  }, [data]);

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
        onRebalancing={onRebalancing ?? (() => undefined)}
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    );
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <TransactionFilters
          filters={activeFilters}
          onChange={handleFilterChange}
          resetFilters={resetFilters}
        />
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
            <Button
              variant="secondary"
              size="md"
              onClick={() => setDeletingId(null)}
            >
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
