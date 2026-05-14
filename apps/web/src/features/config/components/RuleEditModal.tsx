import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FIELD_LIMITS, NEED_WANT_OPTIONS } from '@finance/shared/constants';
import type { Rule } from '@finance/shared/types/rules';
import type { CreateRuleInput, PatchRuleInput } from '@finance/shared/schemas/rules';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/common/FormField';
import { CategorySelect } from '@/components/common/CategorySelect';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(FIELD_LIMITS.RULE_KEYWORD_MAX).trim(),
  matchType: z.enum(['substring', 'wildcard']),
  categoryId: z.string(),
  subcategoryId: z.string(),
  priority: z.number().int().finite(),
  needWant: z.enum(NEED_WANT_OPTIONS).or(z.literal('')),
  flagForReview: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface RuleEditModalProps {
  readonly rule?: Rule;
  readonly onClose: () => void;
  readonly onSave: (input: PatchRuleInput | CreateRuleInput) => Promise<void>;
}

export function RuleEditModal({ rule, onClose, onSave }: RuleEditModalProps) {
  const isCreate = rule === undefined;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      keyword: rule?.keyword ?? '',
      matchType: rule?.matchType ?? 'substring',
      categoryId: rule?.categoryId ?? '',
      subcategoryId: rule?.subcategoryId ?? '',
      priority: rule?.priority ?? 5,
      needWant: rule?.needWant ?? '',
      flagForReview: rule?.flagForReview ?? false,
    },
  });

  useEffect(() => {
    reset({
      keyword: rule?.keyword ?? '',
      matchType: rule?.matchType ?? 'substring',
      categoryId: rule?.categoryId ?? '',
      subcategoryId: rule?.subcategoryId ?? '',
      priority: rule?.priority ?? 5,
      needWant: rule?.needWant ?? '',
      flagForReview: rule?.flagForReview ?? false,
    });
  }, [rule, reset]);

  const flagForReview = watch('flagForReview');
  const matchType = watch('matchType');
  const categoryId = watch('categoryId');
  const subcategoryId = watch('subcategoryId');

  async function onSubmit(values: FormValues) {
    const input: PatchRuleInput | CreateRuleInput = {
      keyword: values.keyword,
      matchType: values.matchType,
      categoryId: values.categoryId || null,
      subcategoryId: values.subcategoryId || null,
      priority: values.priority,
      needWant: values.flagForReview ? null : (values.needWant || null),
      flagForReview: values.flagForReview,
    };
    await onSave(input);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Add rule' : 'Edit rule'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4">
          <FormField label="Keyword" error={errors.keyword?.message}>
            <Input
              {...register('keyword')}
              placeholder="e.g. NETFLIX or AMAZON*"
              maxLength={FIELD_LIMITS.RULE_KEYWORD_MAX}
              className="font-mono"
              autoFocus
            />
          </FormField>

          <FormField label="Match type">
            <div className="flex gap-1 mt-1">
              <button
                type="button"
                onClick={() => setValue('matchType', 'substring')}
                className={cn(
                  'px-3 py-1 text-xs rounded border transition-colors',
                  matchType === 'substring'
                    ? 'bg-content-primary text-white border-content-primary'
                    : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
                )}
              >
                Contains
              </button>
              <button
                type="button"
                onClick={() => setValue('matchType', 'wildcard')}
                className={cn(
                  'px-3 py-1 text-xs rounded border transition-colors',
                  matchType === 'wildcard'
                    ? 'bg-content-primary text-white border-content-primary'
                    : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
                )}
              >
                Wildcard
              </button>
            </div>
            {matchType === 'wildcard' && (
              <p className="mt-1 text-xs text-content-muted">
                * matches anything, ? matches one character
              </p>
            )}
          </FormField>

          {!flagForReview && (
            <FormField label="Category">
              <CategorySelect
                categoryId={categoryId}
                subcategoryId={subcategoryId}
                onCategoryChange={(id) => {
                  setValue('categoryId', id);
                  setValue('subcategoryId', '');
                }}
                onSubcategoryChange={(id) => setValue('subcategoryId', id)}
              />
            </FormField>
          )}

          <FormField label="Flag for review">
            <label className="flex items-center gap-2 mt-1 text-sm text-content-secondary cursor-pointer select-none">
              <Controller
                name="flagForReview"
                control={control}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.checked);
                      if (e.target.checked) setValue('needWant', '');
                    }}
                    className="rounded"
                  />
                )}
              />
              Flag this transaction for manual review
            </label>
          </FormField>

          {!flagForReview && (
            <FormField label="Need / Want">
              <Controller
                name="needWant"
                control={control}
                render={({ field }) => (
                  <div className="flex gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => field.onChange('')}
                      className={cn(
                        'px-3 py-1 text-xs rounded border transition-colors',
                        field.value === ''
                          ? 'bg-content-primary text-white border-content-primary'
                          : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
                      )}
                    >
                      —
                    </button>
                    {NEED_WANT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => field.onChange(opt)}
                        className={cn(
                          'px-3 py-1 text-xs rounded border transition-colors',
                          field.value === opt
                            ? 'bg-content-primary text-white border-content-primary'
                            : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              />
            </FormField>
          )}

          <FormField label="Priority" error={errors.priority?.message}>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Input
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                  className="w-24"
                />
              )}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
