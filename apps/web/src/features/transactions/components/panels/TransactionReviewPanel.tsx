import { FIELD_LIMITS } from '@finance/shared/constants';
import {
  patchTransactionSchema,
  type PatchTransactionFormValues,
} from '@finance/shared/schemas/transactions';
import {
  useConfirmTransfer,
  useDismissTransfer,
  usePatchTransaction,
  useUnmarkTransfer,
} from '@/features/transactions/hooks/useTransactionMutations';
import { AmountCell } from '@/features/transactions/components/table/AmountCell';
import { Button } from '@/components/ui/Button';
import { CategorySelect } from '@/components/common/CategorySelect';
import { Controller, useController, useForm, useWatch } from 'react-hook-form';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/Input';
import type { Transaction } from '@finance/shared/schemas/transactions';
import { cn, parseAmount } from '@/lib/utils';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

interface Props {
  readonly transaction: Transaction;
  readonly onClose: () => void;
  readonly mode?: 'review' | 'edit';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function TransactionReviewPanel({ transaction, onClose, mode = 'review' }: Props) {
  const patch = usePatchTransaction();
  const confirmTransfer = useConfirmTransfer();
  const dismissTransfer = useDismissTransfer();
  const unmarkTransfer = useUnmarkTransfer();

  const [serverError, setServerError] = useState<string | null>(null);

  // TODO: Verify this is intentional. CLAUDE.md specifies that the transfer
  // candidate banner should only appear for transactions that also match
  // TRANSFER_KEYWORDS (from @finance/shared/constants), not for every
  // flaggedForReview transaction. If the API pre-filters this upstream (e.g.
  // only sets flaggedForReview on real transfer candidates), this is fine.
  // Otherwise the banner will show for ordinary uncategorised transactions too.
  const isTransferCandidate = mode === 'review' && transaction.flaggedForReview;
  const isPending =
    patch.isPending ||
    confirmTransfer.isPending ||
    dismissTransfer.isPending ||
    unmarkTransfer.isPending;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PatchTransactionFormValues>({
    resolver: zodResolver(patchTransactionSchema),
    defaultValues: {
      categoryId: transaction.categoryId ?? null,
      subcategoryId: transaction.subcategoryId ?? null,
      needWant: transaction.needWant ?? null,
      note: transaction.note ?? '',
      createRule: false,
      isInvestmentContribution: transaction.isInvestmentContribution,
      date: transaction.date,
      amount: parseAmount(transaction.amount),
      description: transaction.description,
      isIncome: transaction.isIncome,
    },
  });

  const { field: categoryField } = useController({ control, name: 'categoryId' });
  const { field: subcategoryField } = useController({ control, name: 'subcategoryId' });
  const watchedCategoryId = useWatch({ control, name: 'categoryId' });

  async function onSubmit(values: PatchTransactionFormValues) {
    setServerError(null);
    try {
      await patch.mutateAsync({
        id: transaction.id,
        input: {
          categoryId: values.categoryId ?? null,
          subcategoryId: values.subcategoryId ?? null,
          needWant: values.needWant ?? null,
          note: values.note || null,
          createRule: values.createRule ?? false,
          isInvestmentContribution: values.isInvestmentContribution ?? false,
          ...(mode === 'edit' && {
            date: values.date,
            amount: values.amount,
            description: values.description || undefined,
            isIncome: values.isIncome,
          }),
        },
      });
      onClose();
    } catch {
      setServerError('Failed to save changes. Please try again.');
    }
  }

  async function handleConfirmTransfer() {
    setServerError(null);
    try {
      await confirmTransfer.mutateAsync({
        transactionId: transaction.id,
        pairedTransactionId: transaction.transferMatchId ?? undefined,
      });
      onClose();
    } catch {
      setServerError('Failed to confirm transfer. Please try again.');
    }
  }

  async function handleDismissTransfer() {
    setServerError(null);
    try {
      await dismissTransfer.mutateAsync(transaction.id);
      onClose();
    } catch {
      setServerError('Failed to dismiss transfer. Please try again.');
    }
  }

  async function handleUnmarkTransfer() {
    setServerError(null);
    try {
      await unmarkTransfer.mutateAsync(transaction.id);
      onClose();
    } catch {
      setServerError('Failed to remove transfer mark. Please try again.');
    }
  }

  return (
    <div className="bg-info-bg border-t border-info-border px-4 py-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-content-primary truncate pr-4">
          {mode === 'edit' ? 'Edit' : 'Review'}:{' '}
          {transaction.sourceName ?? transaction.description}
        </h3>
        <button
          onClick={onClose}
          className="shrink-0 text-content-muted hover:text-content-secondary transition-colors"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Context bar — read-only summary in review mode */}
      {mode === 'review' && (
        <div className="flex items-center gap-4 pb-2 border-b border-info-border">
          <AmountCell amount={transaction.amount} isTransfer={transaction.isTransfer} />
          <span className="text-xs text-content-muted">{formatDate(transaction.date)}</span>
          <span className="text-xs text-content-muted">{transaction.accountName}</span>
        </div>
      )}

      {/* Editable core fields — edit mode only */}
      {mode === 'edit' && (
        <div className="grid grid-cols-2 gap-3 pb-2 border-b border-info-border">
          <FormField label="Date" labelSize="xs" error={errors.date?.message}>
            <input type="date" className="select-base w-full" {...register('date')} />
          </FormField>
          <FormField label="Amount" labelSize="xs" error={errors.amount?.message}>
            <input
              type="number"
              step="0.01"
              className="select-base w-full"
              {...register('amount')}
            />
          </FormField>
          <div className="col-span-2">
            <FormField label="Description" labelSize="xs" error={errors.description?.message}>
              <input
                type="text"
                className="select-base w-full"
                maxLength={FIELD_LIMITS.TRANSACTION_DESCRIPTION_MAX}
                {...register('description')}
              />
            </FormField>
          </div>
          <label className="flex items-center gap-2 cursor-pointer col-span-2">
            <input type="checkbox" {...register('isIncome')} />
            <span className="label-xs">Income transaction</span>
          </label>
          <span className="text-xs text-content-muted col-span-2">{transaction.accountName}</span>
        </div>
      )}

      {/* Transfer candidate banner — review mode */}
      {isTransferCandidate && (
        <div className="p-3 bg-warning-bg border border-warning-border rounded space-y-2">
          <p className="text-xs text-warning">
            This looks like an internal transfer. Confirm to exclude it from
            income/expense totals.
            {transaction.transferMatchId && (
              <span className="block mt-1 text-content-secondary">
                Suggested pair:{' '}
                {transaction.transferMatchSourceName ?? transaction.transferMatchDescription}{' '}
                &middot; {transaction.transferMatchAccountName}
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="warning"
              size="sm"
              onClick={() => { void handleConfirmTransfer(); }}
              disabled={isPending}
            >
              Confirm transfer
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => { void handleDismissTransfer(); }}
              disabled={isPending}
            >
              Not a transfer
            </Button>
          </div>
        </div>
      )}

      {/* Transfer status banner — edit mode */}
      {mode === 'edit' && (
        <div className="p-3 bg-warning-bg border border-warning-border rounded space-y-2">
          <p className="text-xs text-warning">
            {transaction.isTransfer
              ? 'This transaction is marked as a transfer and excluded from income/expense totals.'
              : 'Mark as a transfer to exclude this transaction from income/expense totals.'}
          </p>
          <div className="flex gap-2">
            {transaction.isTransfer ? (
              <Button
                type="button"
                variant="warning"
                size="sm"
                onClick={() => { void handleUnmarkTransfer(); }}
                disabled={isPending}
              >
                Remove transfer
              </Button>
            ) : (
              <Button
                type="button"
                variant="warning"
                size="sm"
                onClick={() => { void handleConfirmTransfer(); }}
                disabled={isPending}
              >
                Mark as transfer
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
        className="space-y-4"
      >
        <FormField label="Category" labelSize="xs">
          <CategorySelect
            categoryId={categoryField.value ?? ''}
            subcategoryId={subcategoryField.value ?? ''}
            onCategoryChange={(id) => categoryField.onChange(id || null)}
            onSubcategoryChange={(id) => subcategoryField.onChange(id || null)}
            isIncome={parseAmount(transaction.amount) > 0}
          />
          {watchedCategoryId && (
            <button
              type="button"
              className="mt-1 text-xs text-content-muted hover:text-danger transition-colors"
              onClick={() => {
                categoryField.onChange(null);
                subcategoryField.onChange(null);
              }}
            >
              Remove category
            </button>
          )}
        </FormField>

        <fieldset className="border-0 p-0 m-0">
          <legend className="label-xs">Need / Want</legend>
          <Controller
            control={control}
            name="needWant"
            render={({ field }) => (
              <div className="flex gap-2 mt-1">
                {(['Need', 'Want'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => field.onChange(field.value === opt ? null : opt)}
                    className={cn(
                      'px-3 py-1 text-xs rounded border transition-colors',
                      field.value === opt
                        ? opt === 'Need'
                          ? 'bg-info text-white border-info'
                          : 'bg-accent text-white border-accent'
                        : 'border-border-strong text-content-secondary hover:bg-surface-subtle',
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          />
        </fieldset>

        <FormField label="Note" labelSize="xs" error={errors.note?.message}>
          <Input
            type="text"
            placeholder="Add a note..."
            maxLength={FIELD_LIMITS.NOTE_MAX}
            {...register('note')}
          />
        </FormField>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('createRule')} />
          <span className="label-xs">
            Save as rule — apply this category to similar transactions in future imports
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('isInvestmentContribution')} />
          <span className="label-xs">
            Investment contribution — deduct from spending income on the snapshot
          </span>
        </label>

        {serverError && (
          <p className="text-xs text-danger">{serverError}</p>
        )}

        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isPending || (mode === 'review' && !watchedCategoryId)}
              size="md"
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
          </div>
          {mode === 'review' && !watchedCategoryId && (
            <p className="text-xs text-content-muted">A category is required to save.</p>
          )}
        </div>
      </form>

    </div>
  );
}
