import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  useDeactivateAccount,
  useReactivateAccount,
} from '@/features/accounts/hooks/useAccountMutations';
import type { Account } from '@/hooks/useAccounts';
import { ACCOUNT_TYPE_ORDER } from '@finance/shared/constants';
import { AccountEditPanel } from './components/AccountEditPanel';
import { AccountRow } from './components/AccountRow';
import { Button } from '@/components/ui/Button';
import { DeactivateAccountDialog } from './components/DeactivateAccountDialog';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAllAccounts } from '@/hooks/useAccounts';

// Matches the number of Account fields displayed as table columns
const ACCOUNT_SKELETON_ROW_COUNT = 5;

export function AccountsPage() {
  const { data: accounts, isLoading, isError } = useAllAccounts();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeactivateAccount, setConfirmDeactivateAccount] =
    useState<Account | null>(null);
  const deactivate = useDeactivateAccount();
  const reactivate = useReactivateAccount();

  const sorted = useMemo(() => {
    if (!accounts) return [];
    return [...accounts].sort((a, b) => {
      const orderDiff = ACCOUNT_TYPE_ORDER[a.type] - ACCOUNT_TYPE_ORDER[b.type];
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
  }, [accounts]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  let tableBody: ReactNode;
  if (isLoading) {
    tableBody = Array.from({ length: ACCOUNT_SKELETON_ROW_COUNT }, (_, i) => `skeleton-${i}`).map(
      (id) => (
        <tr key={id}>
          <td className="px-4 py-2.5">
            <Skeleton className="h-4 w-32" />
          </td>
          <td className="px-4 py-2.5">
            <Skeleton className="h-4 w-20" />
          </td>
          <td className="px-4 py-2.5">
            <Skeleton className="h-4 w-16" />
          </td>
          <td className="px-4 py-2.5">
            <Skeleton className="h-4 w-12" />
          </td>
          <td className="px-4 py-2.5">
            <Skeleton className="h-5 w-14 rounded-full" />
          </td>
          <td className="px-4 py-2.5 text-right">
            <Skeleton className="inline-block h-6 w-20" />
          </td>
        </tr>
      ),
    );
  } else if (sorted.length === 0) {
    tableBody = (
      <tr>
        <td
          colSpan={6}
          className="px-4 py-6 text-center text-sm text-content-muted"
        >
          No accounts yet. Click &ldquo;Add Account&rdquo; to get started.
        </td>
      </tr>
    );
  } else {
    tableBody = sorted.map((account) => (
      <AccountRow
        key={account.id}
        account={account}
        isExpanded={expandedId === account.id}
        onToggleExpand={toggleExpand}
        onDeactivate={setConfirmDeactivateAccount}
        onReactivate={(id) => reactivate.mutate(id)}
        reactivateIsPending={reactivate.isPending}
      />
    ));
  }

  if (isError) {
    return (
      <PageLayout>
        <p className="text-sm text-danger">Failed to load accounts.</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-content-primary">Accounts</h1>
        <Button
          size="sm"
          onClick={() =>
            setExpandedId((prev) => (prev === 'new' ? null : 'new'))
          }
        >
          Add Account
        </Button>
      </div>

      {expandedId === 'new' && (
        <div className="mb-4">
          <AccountEditPanel
            account={null}
            onClose={() => setExpandedId(null)}
          />
        </div>
      )}

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-content-secondary">
                Name
              </th>
              <th className="px-4 py-2 text-left font-medium text-content-secondary">
                Type
              </th>
              <th className="px-4 py-2 text-left font-medium text-content-secondary">
                Institution
              </th>
              <th className="px-4 py-2 text-left font-medium text-content-secondary">
                Currency
              </th>
              <th className="px-4 py-2 text-left font-medium text-content-secondary">
                Status
              </th>
              <th className="px-4 py-2 text-right font-medium text-content-secondary">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tableBody}
          </tbody>
        </table>
      </div>

      <DeactivateAccountDialog
        account={confirmDeactivateAccount}
        isPending={deactivate.isPending}
        onConfirm={() => {
          if (confirmDeactivateAccount) {
            deactivate.mutate(confirmDeactivateAccount.id, {
              onSuccess: () => setConfirmDeactivateAccount(null),
            });
          }
        }}
        onCancel={() => setConfirmDeactivateAccount(null)}
      />
    </PageLayout>
  );
}
