import { Controller, useFormContext } from 'react-hook-form';
import type { EditAnticipatedBudgetInput } from '@finance/shared/schemas/anticipated-budget';
import {
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/Input';
import { NeedWantToggle } from './NeedWantToggle';
import { Select } from '@/components/ui/Select';
import { useCategories } from '@/hooks/useCategories';

interface Props {
  readonly isPending: boolean;
  readonly submitLabel: string;
  readonly pendingLabel: string;
  readonly onCancel: () => void;
}

export function BudgetEntryFormFields({
  isPending,
  submitLabel,
  pendingLabel,
  onCancel,
}: Props) {
  const { data: categories } = useCategories();

  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EditAnticipatedBudgetInput>();

  const isIncome = watch('isIncome');

  return (
    <>
      <FormField label="Name" error={errors.name?.message}>
        <Input
          disabled={isPending}
          placeholder="e.g. Rent"
          {...register('name')}
        />
      </FormField>

      <FormField label="Category" error={errors.categoryId?.message}>
        <Select
          disabled={isPending}
          {...register('categoryId', {
            setValueAs: (v: string) => (v === '' ? null : v),
          })}
        >
          <option value="">No category</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Type">
        <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
          <Controller
            name="isIncome"
            control={control}
            render={({ field }) => (
              <input
                type="checkbox"
                className="rounded"
                disabled={isPending}
                checked={field.value}
                onChange={(e) => {
                  field.onChange(e.target.checked);
                  if (e.target.checked) setValue('needWant', null);
                }}
              />
            )}
          />
          <span>This is an income entry</span>
        </label>
      </FormField>

      {!isIncome && (
        <FormField label="Need / Want" error={errors.needWant?.message}>
          <Controller
            name="needWant"
            control={control}
            render={({ field }) => (
              <NeedWantToggle
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
              />
            )}
          />
        </FormField>
      )}

      <FormField
        label="Default Monthly Amount"
        error={errors.monthlyAmount?.message}
      >
        <Input
          disabled={isPending}
          placeholder="e.g. 1500.00 (leave blank for overrides only)"
          {...register('monthlyAmount', {
            setValueAs: (v: string | null) =>
              !v || v.trim() === '' ? null : v.trim(),
          })}
        />
      </FormField>

      <FormField label="Notes" error={errors.notes?.message}>
        <Input
          disabled={isPending}
          placeholder="e.g. Annual renewal paid in March"
          {...register('notes', {
            setValueAs: (v: string | null) =>
              !v || v.trim() === '' ? null : v.trim(),
          })}
        />
      </FormField>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
