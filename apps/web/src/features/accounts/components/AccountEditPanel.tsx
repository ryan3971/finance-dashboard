import { AccountForm, type AccountFormState } from './AccountForm';
import {
  useCreateAccount,
  useUpdateAccount,
} from '@/features/accounts/hooks/useAccountMutations';
import type { Account } from '@/features/accounts/hooks/useAccounts';

interface Props {
  readonly account: Account | null;
  readonly onClose: () => void;
}

export function AccountEditPanel({ account, onClose }: Props) {
  const create = useCreateAccount();
  const update = useUpdateAccount();

  const isPending = create.isPending || update.isPending;
  const error = create.error?.message ?? update.error?.message ?? null;

  function handleSubmit(values: AccountFormState) {
    if (account) {
      update.mutate({ id: account.id, input: values }, { onSuccess: onClose });
    } else {
      create.mutate(values, { onSuccess: onClose });
    }
  }

  return (
    <div className="bg-info-bg border-t border-info-border px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-content-primary">
          {account ? `Edit: ${account.name}` : 'Add Account'}
        </h3>
        <button
          onClick={onClose}
          className="text-content-muted hover:text-content-secondary text-sm"
        >
          ✕
        </button>
      </div>
      <AccountForm
        initialValues={account ?? {}}
        isPending={isPending}
        error={error}
        onSubmit={handleSubmit}
        onCancel={onClose}
        submitLabel={account ? 'Save' : 'Add Account'}
        showType={!account}
      />
    </div>
  );
}
