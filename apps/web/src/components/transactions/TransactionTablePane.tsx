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
  useTransactions,
} from '@/features/transactions/hooks/useTransactions';
import { useDeleteTransaction } from '@/features/transactions/hooks/useTransactionMutations';
import type { Transaction, TransactionFilters as TransactionFilterParams } from '@finance/shared/schemas/transactions';
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
import { cn, parseAmount } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDelayedPending } from '@/hooks/useDelayedPending';
import { Search } from 'lucide-react';

interface TransactionTablePaneProps {
  // Changing this value resets internal filter/page state without unmounting the component.
  readonly resetKey?: string;
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
const NOOP_REBALANCING = () => undefined;


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
  resetKey,
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
  const [resetFilters, setResetFilters] = useState<FilterState>({
    ...EMPTY_FILTER_STATE,
    ...defaultFilters,
  });
  const [localFilters, setLocalFilters] = useState<FilterState>(resetFilters);
  const [localPage, setLocalPage] = useState(1);

  // Debounced search: local input drives debouncedSearch which is sent to the API.
  const [debouncedSearch, setDebouncedSearch] = useState(
    filterState?.search ?? resetFilters.search
  );
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Resets internal state when the parent signals a context change (e.g. year/month
  // navigation) without unmounting the component, so keepPreviousData can hold the
  // previous results visible while the new fetch runs.
  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;
    if (!isFilterControlled) {
      const next = { ...EMPTY_FILTER_STATE, ...defaultFilters };
      setResetFilters(next);
      setLocalFilters(next);
      if (!isPageControlled) setLocalPage(1);
    }
    setExpandedPanel(null);
    // defaultFilters is intentionally read from the closure at the moment resetKey
    // fires — tracking it as a dep would cause spurious resets on every render.
    // isFilterControlled and isPageControlled are also omitted: they're derived
    // from stable props and won't change without a remount; adding them would
    // trigger the lint rule without fixing a real bug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

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

  function handleSearchChange(value: string) {
    const next = { ...activeFilters, search: value };
    if (isFilterControlled) {
      onFilterChange?.(next);
    } else {
      setLocalFilters(next);
      if (!isPageControlled) setLocalPage(1);
      onFilterChange?.(next);
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }

  // Keep debouncedSearch in sync when controlled search changes (e.g. browser nav).
  useEffect(() => {
    if (isFilterControlled) setDebouncedSearch(filterState.search);
  }, [isFilterControlled, filterState?.search]);

  function handlePageChange(newPage: number) {
    if (isPageControlled) {
      onPageChange?.(newPage);
    } else {
      setLocalPage(newPage);
    }
    setExpandedPanel(null);
  }

  const { data, isPending, isFetching, isError } = useTransactions({
    accountId: activeFilters.accountId || undefined,
    startDate: activeFilters.startDate || undefined,
    endDate: activeFilters.endDate || undefined,
    month: activeFilters.month || undefined,
    categoryId: activeFilters.categoryId || undefined,
    subcategoryId: activeFilters.subcategoryId || undefined,
    needWant: activeFilters.needWant !== '' ? activeFilters.needWant : undefined,
    flagged: activeFilters.flaggedOnly || undefined,
    isTransfer: activeFilters.isTransfer || undefined,
    tagIds: activeFilters.tagIds.length > 0 ? activeFilters.tagIds : undefined,
    search: debouncedSearch || undefined,
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
    onDataLoadRef.current?.(data?.pagination, data?.flaggedTotal ?? 0);
  }, [data]);

  const showSkeleton = useDelayedPending(isPending);
  const transactions = data?.data ?? [];
  const pagination = data?.pagination;

  let tableContent: React.ReactNode;
  if (showSkeleton) {
    tableContent = <PaneSkeleton />;
  } else if (isError) {
    tableContent = (
      <EmptyState message="Failed to load transactions." variant="error" />
    );
  } else if (!isPending && transactions.length === 0) {
    tableContent = (
      <EmptyState
        message="No transactions found."
        hint="Try adjusting your filters."
      />
    );
  } else if (!isPending) {
    tableContent = (
      <TransactionsTable
        transactions={transactions}
        expandedPanel={expandedPanel}
        onExpand={handlePanelToggle}
        onCollapse={handleCollapse}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteRequest}
        onRebalancing={onRebalancing ?? NOOP_REBALANCING}
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    );
  }

  return (
    <div className={className}>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-content-muted pointer-events-none" />
          <input
            type="search"
            placeholder="Search transactions…"
            value={activeFilters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="select-base w-full pl-8 pr-3"
          />
        </div>
        <TransactionFilters
          filters={activeFilters}
          onChange={handleFilterChange}
          resetFilters={resetFilters}
        />
      </div>

      <div className={cn('transition-opacity duration-200', isFetching && data && 'opacity-50')}>
        {tableContent}
      </div>

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
