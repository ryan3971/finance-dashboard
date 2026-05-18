import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { INVESTMENT_ACCOUNT_TYPES } from '@finance/shared/constants';
import {
  createManualInvestmentTransactionSchema,
  type CreateManualInvestmentTransactionInput,
} from '@finance/shared/schemas/investments';
import { useAccounts } from '@/hooks/useAccounts';
import { useCreateManualInvestmentTransaction } from '../hooks/useCreateManualInvestmentTransaction';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/errors';

const INVESTMENT_TYPES_SET = new Set<string>(INVESTMENT_ACCOUNT_TYPES);

const ACTION_OPTIONS = [
  { value: 'buy',        label: 'Buy' },
  { value: 'sell',       label: 'Sell' },
  { value: 'deposit',    label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'dividend',   label: 'Dividend' },
  { value: 'transfer',   label: 'Transfer' },
  { value: 'fee',        label: 'Fee' },
] as const;

// Actions where cash flows out → stored as a negative amount.
const CASH_OUT_ACTIONS = new Set(['buy', 'fee', 'withdrawal']);

interface Props {
  readonly onClose: () => void;
}

export function ManualInvestmentTransactionPanel({ onClose }: Props) {
  const { data: allAccounts } = useAccounts();
  const investmentAccounts = allAccounts?.filter((a) => INVESTMENT_TYPES_SET.has(a.type)) ?? [];

  const mutation = useCreateManualInvestmentTransaction();

  // Transfer-direction is not part of the Zod schema; it only drives the sign.
  const [transferDirection, setTransferDirection] = useState<'in' | 'out'>('in');

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateManualInvestmentTransactionInput>({
    resolver: zodResolver(createManualInvestmentTransactionSchema),
    defaultValues: {
      accountId: '',
      date:      new Date().toISOString().split('T')[0],
      action:    'deposit',
      currency:  'CAD',
    },
  });

  const watchedAction = useWatch({ control, name: 'action' });
  const isTransfer = watchedAction === 'transfer';

  async function onSubmit(values: CreateManualInvestmentTransactionInput) {
    const rawAmount = Math.abs(values.amount);

    let signedAmount: number;
    if (isTransfer) {
      signedAmount = transferDirection === 'out' ? -rawAmount : rawAmount;
    } else {
      signedAmount = CASH_OUT_ACTIONS.has(values.action) ? -rawAmount : rawAmount;
    }

    await mutation.mutateAsync({ ...values, amount: signedAmount });

    reset({
      accountId:    '',
      date:         new Date().toISOString().split('T')[0],
      action:       'deposit',
      amount:       undefined,
      currency:     'CAD',
      symbol:       undefined,
      description:  undefined,
      quantity:     undefined,
      price:        undefined,
      activityType: undefined,
      note:         undefined,
    });
    setTransferDirection('in');
  }

  const serverError = mutation.error
    ? getApiErrorMessage(mutation.error, 'Failed to add transaction')
    : null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-surface border-l border-border-base shadow-xl overflow-y-auto z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border-subtle">
        <h2 className="text-sm font-medium text-content-primary">
          Add Investment Transaction
        </h2>
        <button
          onClick={onClose}
          className="text-content-muted hover:text-content-secondary text-sm"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      <form
        onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
        className="flex flex-col flex-1 px-4 py-4 space-y-4"
      >
        {/* Account — filtered to investment account types */}
        <FormField label="Account" error={errors.accountId?.message} labelSize="xs">
          <Select {...register('accountId')}>
            <option value="">Select account…</option>
            {investmentAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </FormField>

        {/* Date */}
        <FormField label="Date" error={errors.date?.message} labelSize="xs">
          <Input type="date" {...register('date')} />
        </FormField>

        {/* Action */}
        <FormField label="Action" error={errors.action?.message} labelSize="xs">
          <Select {...register('action')}>
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FormField>

        {/* Transfer direction — visible only when action = transfer */}
        {isTransfer && (
          <fieldset className="border-0 p-0 m-0">
            <legend className="label-xs">Direction</legend>
            <div className="flex gap-2 mt-1">
              {(['in', 'out'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setTransferDirection(dir)}
                  className={cn(
                    'px-3 py-1 text-xs rounded border transition-colors capitalize',
                    transferDirection === dir
                      ? 'bg-content-primary text-white border-content-primary'
                      : 'border-border-strong text-content-secondary hover:bg-surface-subtle',
                  )}
                >
                  {dir}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Amount — user always enters a positive value; sign is applied in onSubmit */}
        <FormField label="Amount (positive)" error={errors.amount?.message} labelSize="xs">
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 500.00"
            {...register('amount', { valueAsNumber: true })}
          />
        </FormField>

        {/* Currency */}
        <FormField label="Currency" error={errors.currency?.message} labelSize="xs">
          <Select {...register('currency')}>
            <option value="CAD">CAD</option>
            <option value="USD">USD</option>
          </Select>
        </FormField>

        {/* Symbol */}
        <FormField label="Symbol" error={errors.symbol?.message} labelSize="xs">
          <Input
            type="text"
            placeholder="e.g. VFV.TO"
            {...register('symbol')}
          />
        </FormField>

        {/* Description */}
        <FormField label="Description" error={errors.description?.message} labelSize="xs">
          <Input
            type="text"
            placeholder="Optional description…"
            {...register('description')}
          />
        </FormField>

        {/* Quantity */}
        <FormField label="Quantity" error={errors.quantity?.message} labelSize="xs">
          <Input
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 10"
            {...register('quantity', { valueAsNumber: true })}
          />
        </FormField>

        {/* Price per unit */}
        <FormField label="Price per unit" error={errors.price?.message} labelSize="xs">
          <Input
            type="number"
            step="0.0001"
            min="0"
            placeholder="e.g. 100.00"
            {...register('price', { valueAsNumber: true })}
          />
        </FormField>

        {/* Activity type */}
        <FormField label="Activity type" error={errors.activityType?.message} labelSize="xs">
          <Input
            type="text"
            placeholder="e.g. Employer contribution"
            {...register('activityType')}
          />
        </FormField>

        {/* Note */}
        <FormField label="Note" error={errors.note?.message} labelSize="xs">
          <Input
            type="text"
            placeholder="Optional note…"
            {...register('note')}
          />
        </FormField>

        {serverError && (
          <p className="text-xs text-danger">{serverError}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={mutation.isPending} size="md">
            {mutation.isPending ? 'Adding…' : 'Add Transaction'}
          </Button>
          <Button variant="secondary" size="md" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </form>
    </div>
  );
}
