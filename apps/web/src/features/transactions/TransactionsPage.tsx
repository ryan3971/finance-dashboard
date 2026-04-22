import { type FilterState } from '@/features/transactions/components/filters/filterState';
import { triggerCsvDownload } from '@/features/transactions/utils/exportCsv';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ManualTransactionPanel } from '@/features/transactions/components/panels/ManualTransactionPanel';
import { PageLayout } from '@/components/layout/PageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { TransactionTablePane } from '@/components/transactions/TransactionTablePane';
import { RebalancingPanel } from '@/features/transactions/components/rebalancing/RebalancingPanel';
import { RebalancingTab } from '@/features/transactions/components/rebalancing/RebalancingTab';
import type { PaginationInfo } from '@/features/transactions/hooks/useTransactions';
import type { Transaction } from '@finance/shared/schemas/transactions';
import { useCallback, useMemo, useState } from 'react';
import api from '@/lib/api';
import { PAGINATION } from '@finance/shared/constants';

export function TransactionsPage() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const [isExporting, setIsExporting] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo | undefined>();
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'transactions' | 'rebalancing'>(
    'transactions'
  );
  const [rebalancingTx, setRebalancingTx] = useState<Transaction | null>(null);

  const handleRebalancing = useCallback((tx: Transaction) => {
    setRebalancingTx(tx);
  }, []);

  const filters = useMemo<FilterState>(
    () => ({
      accountId: search.accountId ?? '',
      startDate: search.startDate ?? '',
      endDate: search.endDate ?? '',
      month: search.month ?? '',
      categoryId: search.categoryId ?? '',
      subcategoryId: search.subcategoryId ?? '',
      needWant: search.needWant ?? '',
      flaggedOnly: search.flaggedOnly ?? false,
      isTransfer: search.isTransfer ?? false,
      tagIds: search.tagIds ?? [],
    }),
    [
      search.accountId,
      search.startDate,
      search.endDate,
      search.month,
      search.categoryId,
      search.subcategoryId,
      search.needWant,
      search.flaggedOnly,
      search.isTransfer,
      search.tagIds,
    ]
  );
  const page = search.page ?? 1;

  function handleFilterChange(newFilters: FilterState) {
    void navigate({
      search: {
        accountId: newFilters.accountId || undefined,
        startDate: newFilters.startDate || undefined,
        endDate: newFilters.endDate || undefined,
        month: newFilters.month || undefined,
        categoryId: newFilters.categoryId || undefined,
        subcategoryId: newFilters.subcategoryId || undefined,
        needWant: newFilters.needWant || undefined,
        flaggedOnly: newFilters.flaggedOnly || undefined,
        isTransfer: newFilters.isTransfer || undefined,
        tagIds: newFilters.tagIds.length > 0 ? newFilters.tagIds : undefined,
        page: undefined,
      },
    });
  }

  function handlePageChange(newPage: number) {
    void navigate({ search: (prev) => ({ ...prev, page: newPage }) });
  }

  const handleDataLoad = useCallback(
    (paginationInfo: PaginationInfo | undefined, count: number) => {
      setPagination(paginationInfo);
      setFlaggedCount(count);
    },
    []
  );

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
            month: filters.month || undefined,
            categoryId: filters.categoryId || undefined,
            subcategoryId: filters.subcategoryId || undefined,
            needWant: filters.needWant || undefined,
            flagged: filters.flaggedOnly || undefined,
            isTransfer: filters.isTransfer || undefined,
            tagIds: filters.tagIds.length > 0 ? filters.tagIds : undefined,
            limit: PAGINATION.EXPORT_LIMIT,
          },
        }
      );
      triggerCsvDownload(result.data, filters);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <PageLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">
            Transactions
          </h1>
          {activeTab === 'transactions' && pagination && (
            <p className="text-sm text-content-muted mt-0.5">
              {pagination.total} total
            </p>
          )}
        </div>
        {activeTab === 'transactions' && (
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
            <Button size="sm" onClick={() => setAddPanelOpen(true)}>
              Add Transaction
            </Button>
          </div>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          if (v === 'transactions' || v === 'rebalancing') setActiveTab(v);
          setAddPanelOpen(false);
          setRebalancingTx(null);
        }}
      >
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="rebalancing">Rebalancing</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <TransactionTablePane
            filterState={filters}
            onFilterChange={handleFilterChange}
            page={page}
            onPageChange={handlePageChange}
            onDataLoad={handleDataLoad}
            onRebalancing={handleRebalancing}
          />
        </TabsContent>

        <TabsContent value="rebalancing">
          <RebalancingTab />
        </TabsContent>
      </Tabs>

      {addPanelOpen && (
        <ManualTransactionPanel onClose={() => setAddPanelOpen(false)} />
      )}

      {rebalancingTx !== null && (
        rebalancingTx.rebalancingGroupId !== null ? (
          <RebalancingPanel
            transactionId={rebalancingTx.id}
            description={rebalancingTx.sourceName ?? rebalancingTx.description}
            rebalancingGroupId={rebalancingTx.rebalancingGroupId}
            rebalancingRole={rebalancingTx.rebalancingRole ?? 'source'}
            onClose={() => setRebalancingTx(null)}
          />
        ) : (
          <RebalancingPanel
            transactionId={rebalancingTx.id}
            description={rebalancingTx.sourceName ?? rebalancingTx.description}
            rebalancingGroupId={null}
            rebalancingRole={null}
            onClose={() => setRebalancingTx(null)}
          />
        )
      )}
    </PageLayout>
  );
}
