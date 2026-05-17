import {
  editAnticipatedBudgetSchema,
  type EditAnticipatedBudgetInput,
} from '@finance/shared/schemas/anticipated-budget';
import type { AnticipatedBudgetEntry } from '@finance/shared/types/anticipated-budget';
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
  readonly entry: AnticipatedBudgetEntry;
  readonly isPending: boolean;
  readonly onSubmit: (data: EditAnticipatedBudgetInput) => void;
}

function entryToFormValues(entry: AnticipatedBudgetEntry): EditAnticipatedBudgetInput {
  return {
    name: entry.name,
    categoryId: entry.categoryId,
    needWant: entry.needWant,
    isIncome: entry.isIncome,
    monthlyAmount: entry.monthlyAmount !== null ? String(entry.monthlyAmount) : null,
    notes: entry.notes,
  };
}

export function EditEntryDialog({
  open,
  onOpenChange,
  entry,
  isPending,
  onSubmit,
}: Props) {
  const methods = useForm<EditAnticipatedBudgetInput>({
    resolver: zodResolver(editAnticipatedBudgetSchema),
    defaultValues: entryToFormValues(entry),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Budget Entry</DialogTitle>
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
              submitLabel="Save Changes"
              pendingLabel="Saving…"
              onCancel={() => onOpenChange(false)}
            />
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
