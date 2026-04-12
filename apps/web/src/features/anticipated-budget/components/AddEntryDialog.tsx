import { NEED_WANT_OPTIONS } from '@finance/shared/constants';
import {
  type CreateAnticipatedBudgetInput,
  createAnticipatedBudgetSchema,
} from '@finance/shared/schemas/anticipated-budget';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Controller, useForm } from 'react-hook-form';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCategories } from '@/hooks/useCategories';
import { zodResolver } from '@hookform/resolvers/zod';

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (input: CreateAnticipatedBudgetInput) => void;
  readonly isPending: boolean;
  readonly effectiveYear: number;
}

export function AddEntryDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  effectiveYear,
}: Props) {
  const { data: categories } = useCategories();

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateAnticipatedBudgetInput>({
    resolver: zodResolver(createAnticipatedBudgetSchema),
    defaultValues: {
      name: '',
      categoryId: null,
      needWant: 'Need',
      isIncome: false,
      monthlyAmount: null,
      notes: null,
      effectiveYear,
    },
  });

  const isIncome = watch('isIncome');

  function handleFormSubmit(data: CreateAnticipatedBudgetInput) {
    onSubmit(data);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Budget Entry</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(handleFormSubmit)(e);
          }}
          className="space-y-4"
        >
          <FormField label="Name" error={errors.name?.message}>
            <Input placeholder="e.g. Rent" {...register('name')} />
          </FormField>

          <FormField label="Category" error={errors.categoryId?.message}>
            <Select {...register('categoryId')}>
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
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
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
                  <div className="flex gap-1">
                    {NEED_WANT_OPTIONS.filter((o) => o !== 'NA').map((opt) => (
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
                    <button
                      type="button"
                      onClick={() => field.onChange(null)}
                      className={`px-3 py-1 text-xs rounded border transition-colors ${
                        field.value === null
                          ? 'bg-content-primary text-white border-content-primary'
                          : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
                      }`}
                    >
                      Unset
                    </button>
                  </div>
                )}
              />
            </FormField>
          )}

          <FormField
            label="Default Monthly Amount"
            error={errors.monthlyAmount?.message}
          >
            <Input
              placeholder="e.g. 1500.00 (leave blank for overrides only)"
              {...register('monthlyAmount', {
                setValueAs: (v: string | null) => (!v || v.trim() === '' ? null : v.trim()),
              })}
            />
          </FormField>

          <FormField label="Notes" error={errors.notes?.message}>
            <Input
              placeholder="e.g. Annual renewal paid in March"
              {...register('notes', {
                setValueAs: (v: string | null) => (!v || v.trim() === '' ? null : v.trim()),
              })}
            />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding…' : 'Add Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
