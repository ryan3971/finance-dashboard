import { useEffect } from 'react';
import {
  type CreateAnticipatedBudgetInput,
  createAnticipatedBudgetSchema,
} from '@finance/shared/schemas/anticipated-budget';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { BudgetEntryFormFields } from './BudgetEntryFormFields';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (input: CreateAnticipatedBudgetInput) => void;
  readonly isPending: boolean;
  readonly effectiveYear: number;
}

function freshValues(effectiveYear: number): CreateAnticipatedBudgetInput {
  return {
    name: '',
    categoryId: null,
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: null,
    notes: null,
    effectiveYear,
  };
}

export function AddEntryDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  effectiveYear,
}: Props) {
  const methods = useForm<CreateAnticipatedBudgetInput>({
    resolver: zodResolver(createAnticipatedBudgetSchema),
    defaultValues: freshValues(effectiveYear),
  });

  // Reset to fresh state (with the current year) each time the dialog opens.
  // This also prevents effectiveYear from going stale when the user changes
  // the year selector while the dialog is already mounted.
  useEffect(() => {
    if (open) methods.reset(freshValues(effectiveYear));
  }, [open, effectiveYear, methods]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Budget Entry</DialogTitle>
        </DialogHeader>
        <FormProvider {...methods}>
          <form
            onSubmit={(e) => {
              void methods.handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            <BudgetEntryFormFields
              isPending={isPending}
              submitLabel="Add Entry"
              pendingLabel="Adding…"
              onCancel={() => onOpenChange(false)}
            />
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
