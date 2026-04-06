import type { Account } from '@/features/accounts/hooks/useAccounts';
import { AccountEditPanel } from './AccountEditPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Fragment } from 'react';

interface Props {
  account: Account;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onDeactivate: (account: Account) => void;
  onReactivate: (id: string) => void;
  reactivateIsPending: boolean;
}

export function AccountRow({
  account,
  isExpanded,
  onToggleExpand,
  onDeactivate,
  onReactivate,
  reactivateIsPending,
}: Props) {
  return (
    <Fragment>
      <tr className={account.isActive ? '' : 'opacity-50'}>
        <td className="px-4 py-2 text-content-primary">{account.name}</td>
        <td className="px-4 py-2 text-content-secondary">{account.type}</td>
        <td className="px-4 py-2 text-content-secondary">
          {account.institution.toUpperCase()}
        </td>
        <td className="px-4 py-2 text-content-secondary">{account.currency}</td>
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
              onClick={() => onToggleExpand(account.id)}
            >
              Edit
            </Button>
            {account.isActive ? (
              <Button
                variant="warning"
                size="sm"
                onClick={() => onDeactivate(account)}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={reactivateIsPending}
                onClick={() => onReactivate(account.id)}
              >
                Reactivate
              </Button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <AccountEditPanel
              account={account}
              onClose={() => onToggleExpand(account.id)}
            />
          </td>
        </tr>
      )}
    </Fragment>
  );
}
