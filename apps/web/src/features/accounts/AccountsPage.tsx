import {
  useDeactivateAccount,
  useReactivateAccount,
} from '@/hooks/useAccountMutations';
import { Fragment, useMemo, useState } from 'react';
import { ACCOUNT_TYPE_ORDER } from '@finance/shared';
import { AccountEditPanel } from './AccountEditPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLayout } from '@/components/layout/PageLayout';
import { useAllAccounts } from '@/hooks/useAccounts';

export function AccountsPage() {
  const { data: accounts, isLoading, isError } = useAllAccounts();
  const [expandedId, setExpandedId] = useState<string | 'new' | null>(null);
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

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (isLoading) {
    return (
      <PageLayout>
        <p className="text-sm text-content-muted">Loading accounts...</p>
      </PageLayout>
    );
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
            {sorted.map((account) => (
              <Fragment key={account.id}>
                <tr
                  className={account.isActive ? '' : 'opacity-50'}
                >
                  <td className="px-4 py-2 text-content-primary">
                    {account.name}
                  </td>
                  <td className="px-4 py-2 text-content-secondary">
                    {account.type}
                  </td>
                  <td className="px-4 py-2 text-content-secondary">
                    {account.institution.toUpperCase()}
                  </td>
                  <td className="px-4 py-2 text-content-secondary">
                    {account.currency}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={account.isActive ? 'success' : 'neutral'}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(account.id)}
                      >
                        Edit
                      </Button>
                      {account.isActive ? (
                        <Button
                          variant="warning"
                          size="sm"
                          disabled={deactivate.isPending}
                          onClick={() => deactivate.mutate(account.id)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={reactivate.isPending}
                          onClick={() => reactivate.mutate(account.id)}
                        >
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === account.id && (
                  <tr key={`${account.id}-panel`}>
                    <td colSpan={6} className="p-0">
                      <AccountEditPanel
                        account={account}
                        onClose={() => setExpandedId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}
