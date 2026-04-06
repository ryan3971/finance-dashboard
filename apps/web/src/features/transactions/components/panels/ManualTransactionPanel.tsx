import {
  createTransactionSchema,
  type CreateTransactionInput,
  FIELD_LIMITS,
  NEED_WANT_OPTIONS,
  type NeedWant,
} from '@finance/shared';
import { type z } from 'zod';
import { useTags } from '@/features/transactions/hooks/useTags';
import { useSubmitManualTransaction } from '@/features/transactions/hooks/useSubmitManualTransaction';
import { useTagSelection } from '@/features/transactions/hooks/useTagSelection';
import { Button } from '@/components/ui/Button';
import { CategorySelect } from '@/components/common/CategorySelect';
import { Controller, useController, useForm } from 'react-hook-form';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { zodResolver } from '@hookform/resolvers/zod';

const DEFAULT_TAG_COLOR = '#6B7280';

export interface ManualTransactionInitialValues {
  accountId?: string;
  description?: string;
  amount?: number;
  categoryId?: string;
  subcategoryId?: string;
  needWant?: NeedWant;
  note?: string;
  tagIds?: string[];
}

interface Props {
  initialValues?: ManualTransactionInitialValues;
  onClose: () => void;
}

export function ManualTransactionPanel({ initialValues, onClose }: Props) {
  const { data: accounts } = useAccounts();
  const { data: allTags } = useTags();
  const { submit, serverError, isSubmitting } = useSubmitManualTransaction();
  const { selectedTagIds, toggleTag, resetTags } = useTagSelection(
    initialValues?.tagIds
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof createTransactionSchema>, unknown, CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      accountId: initialValues?.accountId ?? '',
      date: new Date().toISOString().split('T')[0],
      description: initialValues?.description ?? '',
      amount: initialValues?.amount,
      categoryId: initialValues?.categoryId ?? null,
      subcategoryId: initialValues?.subcategoryId ?? null,
      needWant: initialValues?.needWant ?? 'NA',
      note: initialValues?.note ?? '',
    },
  });

  const { field: categoryField } = useController({ control, name: 'categoryId' });
  const { field: subcategoryField } = useController({ control, name: 'subcategoryId' });

  async function onSubmit(values: CreateTransactionInput) {
    const success = await submit(values, selectedTagIds);
    if (success) {
      reset({
        accountId: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: undefined,
        categoryId: null,
        subcategoryId: null,
        needWant: 'NA',
        note: '',
      });
      resetTags();
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-surface border-l border-border-base shadow-xl overflow-y-auto z-40 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border-subtle">
        <h2 className="text-sm font-medium text-content-primary">
          Add Transaction
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
        onSubmit={(e) => {
          void handleSubmit(onSubmit)(e);
        }}
        className="flex flex-col flex-1 px-4 py-4 space-y-4"
      >
        <FormField label="Account" error={errors.accountId?.message} labelSize="xs">
          <Select {...register('accountId')}>
            <option value="">Select account…</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Date" error={errors.date?.message} labelSize="xs">
          <Input type="date" {...register('date')} />
        </FormField>

        <FormField
          label="Description"
          error={errors.description?.message}
          labelSize="xs"
        >
          <Input
            type="text"
            placeholder="e.g. Grocery store"
            maxLength={FIELD_LIMITS.NOTE_MAX}
            {...register('description')}
          />
        </FormField>

        <FormField label="Amount" error={errors.amount?.message} labelSize="xs">
          <Input
            type="number"
            step="0.01"
            placeholder="e.g. -42.50"
            {...register('amount')}
          />
        </FormField>

        <FormField label="Category" labelSize="xs">
          <CategorySelect
            categoryId={categoryField.value ?? ''}
            subcategoryId={subcategoryField.value ?? ''}
            onCategoryChange={(id) => categoryField.onChange(id || null)}
            onSubcategoryChange={(id) => subcategoryField.onChange(id || null)}
          />
        </FormField>

        <div>
          <label className="label-xs">Need / Want</label>
          <Controller
            control={control}
            name="needWant"
            render={({ field }) => (
              <div className="flex gap-2 mt-1">
                {NEED_WANT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => field.onChange(opt)}
                    className={`px-3 py-1 text-xs rounded border transition-colors ${
                      field.value === opt
                        ? 'bg-content-primary text-white border-content-primary'
                        : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          />
        </div>

        <FormField label="Note" error={errors.note?.message} labelSize="xs">
          <Input
            type="text"
            placeholder="Optional note…"
            maxLength={FIELD_LIMITS.NOTE_MAX}
            {...register('note')}
          />
        </FormField>

        {allTags?.length ? (
          <div>
            <label className="label-xs">Tags</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {allTags.map((tag) => {
                const selected = selectedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-opacity ${
                      selected ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                    }`}
                    style={{
                      backgroundColor: tag.color ?? DEFAULT_TAG_COLOR,
                      color: '#fff',
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {serverError && <p className="text-xs text-danger">{serverError}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting} size="md">
            {isSubmitting ? 'Adding…' : 'Add Transaction'}
          </Button>
          <Button variant="secondary" size="md" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </form>
    </div>
  );
}
