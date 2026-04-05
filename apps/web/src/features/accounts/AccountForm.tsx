import {
  ACCOUNT_TYPES,
  type AccountType,
  DEFAULT_CURRENCY,
  type Institution,
  INSTITUTIONS,
} from '@finance/shared';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useState } from 'react';

export interface AccountFormState {
  name: string;
  type: AccountType;
  institution: Institution;
  currency: string;
  isCredit: boolean;
}

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
  const [name, setName] = useState(initialValues.name ?? '');
  const [type, setType] = useState<AccountType>(
    initialValues.type ?? ACCOUNT_TYPES[0]
  );
  const [institution, setInstitution] = useState<Institution>(
    initialValues.institution ?? INSTITUTIONS[0]
  );
  const [currency, setCurrency] = useState(
    initialValues.currency ?? DEFAULT_CURRENCY
  );
  const [isCredit, setIsCredit] = useState(initialValues.isCredit ?? false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, type, institution, currency, isCredit });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Name" labelSize="xs">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Chequing"
          />
        </FormField>
        <FormField label="Institution" labelSize="xs">
          <Select
            value={institution}
            onChange={(e) => setInstitution(e.target.value as Institution)}
          >
            {INSTITUTIONS.map((inst) => (
              <option key={inst} value={inst}>
                {inst.toUpperCase()}
              </option>
            ))}
          </Select>
        </FormField>
        {showType && (
          <FormField label="Type" labelSize="xs">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Currency" labelSize="xs">
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            required
            placeholder="CAD"
          />
        </FormField>
      </div>
      {!showType && (
        <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={isCredit}
            onChange={(e) => setIsCredit(e.target.checked)}
            className="rounded"
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
