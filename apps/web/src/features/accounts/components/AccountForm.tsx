import {
  ACCOUNT_TYPES,
  type AccountFormInput,
  accountFormSchema,
  DEFAULT_CURRENCY,
  INSTITUTIONS,
} from '@finance/shared';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export type AccountFormState = AccountFormInput;

interface AccountFormProps {
  initialValues: Partial<AccountFormState>;
  isPending: boolean;
  error: string | null;
  onSubmit: (values: AccountFormState) => void;
  onCancel: () => void;
  submitLabel: string;
  showType?: boolean;
}

export function AccountForm({
  initialValues,
  isPending,
  error,
  onSubmit,
  onCancel,
  submitLabel,
  showType = true,
}: AccountFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormState>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: initialValues.name ?? '',
      type: initialValues.type ?? ACCOUNT_TYPES[0],
      institution: initialValues.institution ?? INSTITUTIONS[0],
      currency: initialValues.currency ?? DEFAULT_CURRENCY,
      isCredit: initialValues.isCredit ?? false,
    },
  });

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Name" labelSize="xs" error={errors.name?.message}>
          <Input placeholder="e.g. Chequing" {...register('name')} />
        </FormField>
        <FormField
          label="Institution"
          labelSize="xs"
          error={errors.institution?.message}
        >
          <Select {...register('institution')}>
            {INSTITUTIONS.map((inst) => (
              <option key={inst} value={inst}>
                {inst.toUpperCase()}
              </option>
            ))}
          </Select>
        </FormField>
        {showType && (
          <FormField label="Type" labelSize="xs" error={errors.type?.message}>
            <Select {...register('type')}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField
          label="Currency"
          labelSize="xs"
          error={errors.currency?.message}
        >
          <Input
            maxLength={3}
            placeholder="CAD"
            {...register('currency', {
              setValueAs: (v: string) => v.toUpperCase(),
            })}
          />
        </FormField>
      </div>
      {!showType && (
        <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
          <input
            type="checkbox"
            className="rounded"
            {...register('isCredit')}
          />
          Credit account
        </label>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
