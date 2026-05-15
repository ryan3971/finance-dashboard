import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FIELD_LIMITS, NEED_WANT_OPTIONS, RULE_PRIORITY_DEFAULT } from '@finance/shared/constants';
import type { Rule } from '@finance/shared/types/rules';
import type { CreateRuleInput, PatchRuleInput } from '@finance/shared/schemas/rules';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { FormField } from '@/components/common/FormField';
import { CategorySelect } from '@/components/common/CategorySelect';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

// Uses empty strings for nullable foreign keys (categoryId, subcategoryId) so RHF
// can manage uncontrolled-empty state. onSubmit converts '' → null before the API call.
const ruleFormSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(FIELD_LIMITS.RULE_KEYWORD_MAX).trim(),
  matchType: z.enum(['substring', 'wildcard']),
  categoryId: z.string(),
  subcategoryId: z.string(),
  priority: z.number().int().finite(),
  needWant: z.enum(NEED_WANT_OPTIONS).or(z.literal('')),
  flagForReview: z.boolean(),
});

type FormValues = z.infer<typeof ruleFormSchema>;

interface RuleEditModalProps {
  readonly rule?: Rule;
  readonly onClose: () => void;
  readonly onCreate: (input: CreateRuleInput) => Promise<void>;
  readonly onUpdate: (input: PatchRuleInput) => Promise<void>;
}

export function RuleEditModal({ rule, onClose, onCreate, onUpdate }: RuleEditModalProps) {
  const isCreate = rule === undefined;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      keyword: rule?.keyword ?? '',
      matchType: rule?.matchType ?? 'substring',
      categoryId: rule?.categoryId ?? '',
      subcategoryId: rule?.subcategoryId ?? '',
      priority: rule?.priority ?? RULE_PRIORITY_DEFAULT,
      needWant: rule?.needWant ?? '',
      flagForReview: rule?.flagForReview ?? false,
    },
  });

  const flagForReview = watch('flagForReview');
  const categoryId = watch('categoryId');
  const subcategoryId = watch('subcategoryId');

  async function onSubmit(values: FormValues) {
    const input = {
      keyword: values.keyword,
      matchType: values.matchType,
      categoryId: values.categoryId || null,
      subcategoryId: values.subcategoryId || null,
      priority: values.priority,
      needWant: values.flagForReview ? null : (values.needWant || null),
      flagForReview: values.flagForReview,
    };
    if (isCreate) {
      await onCreate(input);
    } else {
      await onUpdate(input);
    }
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
            <Controller
              name="matchType"
              control={control}
              render={({ field }) => (
                <>
                  <SegmentedControl
                    options={[
                      { value: 'substring' as const, label: 'Contains' },
                      { value: 'wildcard' as const, label: 'Wildcard' },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                  />
                  {field.value === 'wildcard' && (
                    <p className="mt-1 text-xs text-content-muted">
                      * matches anything, ? matches one character
                    </p>
                  )}
                </>
              )}
            />
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
                      if (e.target.checked) {
                        setValue('needWant', '');
                        setValue('categoryId', '');
                        setValue('subcategoryId', '');
                      }
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
                  <SegmentedControl
                    options={[
                      { value: '' as const, label: '—' },
                      ...NEED_WANT_OPTIONS.map((opt) => ({ value: opt, label: opt })),
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
          )}

          <FormField label="Priority" error={errors.priority?.message}>
            <Input
              {...register('priority', { valueAsNumber: true })}
              type="number"
              className="w-24"
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
