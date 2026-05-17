import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { fmt } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { AccountContributionSummary } from '@finance/shared/types/investments';
import { useContributionRoomMutation } from '../hooks/useContributionRoomMutation';

const ACCOUNT_TYPE_VARIANT: Record<string, 'info' | 'success' | 'accent'> = {
  tfsa: 'success',
  rrsp: 'info',
  fhsa: 'accent',
};

interface EditableCellProps {
  readonly value: number | null;
  readonly isEditing: boolean;
  readonly editValue: string;
  readonly onStartEdit: () => void;
  readonly onEditChange: (v: string) => void;
  readonly isLoading: boolean;
  readonly suffix?: React.ReactNode;
}

function EditableCell({
  value,
  isEditing,
  editValue,
  onStartEdit,
  onEditChange,
  isLoading,
  suffix,
}: EditableCellProps) {
  if (isEditing) {
    return (
      <input
        type="number"
        min="0"
        step="0.01"
        value={editValue}
        onChange={(e) => onEditChange(e.target.value)}
        className="input-base w-28 text-sm"
        disabled={isLoading}
        autoFocus
      />
    );
  }

  return (
    <span className="group inline-flex items-center gap-1.5">
      <span className="text-sm text-content-secondary">
        {value !== null ? fmt(value) : '—'}
      </span>
      {suffix}
      <button
        onClick={onStartEdit}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-content-muted hover:text-content-primary text-xs"
        aria-label="Edit"
      >
        ✏️
      </button>
    </span>
  );
}

interface Props {
  readonly account: AccountContributionSummary;
  readonly year: number;
}

export function ContributionRoomRow({ account, year }: Props) {
  const [editField, setEditField] = useState<'annualLimit' | 'roomCarried' | null>(null);
  const [editValue, setEditValue] = useState('');
  const mutation = useContributionRoomMutation();

  function startEdit(field: 'annualLimit' | 'roomCarried') {
    const current = field === 'annualLimit' ? account.annualLimit : account.roomCarried;
    setEditValue(current?.toString() ?? '');
    setEditField(field);
  }

  function cancelEdit() {
    setEditField(null);
    setEditValue('');
  }

  function handleSave() {
    const num = parseFloat(editValue);
    if (isNaN(num) || num < 0) {
      cancelEdit();
      return;
    }
    mutation.mutate(
      {
        accountId: account.accountId,
        year,
        body: {
          ...(editField === 'annualLimit'
            ? { annualLimit: num, roomCarriedConfirmed: true }
            : { roomCarried: num, roomCarriedConfirmed: true }),
        },
      },
      { onSuccess: cancelEdit }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') cancelEdit();
  }

  const roomCarriedSuffix = account.roomCarriedIsEstimate ? (
    <span title="Estimated from prior-year transactions. Save to confirm.">
      <Badge variant="neutral" className="text-xs">Est.</Badge>
    </span>
  ) : null;

  const availableRoomClass = cn(
    'text-sm font-mono font-medium',
    account.availableRoom !== null && account.availableRoom < 0
      ? 'text-danger'
      : 'text-content-primary'
  );

  return (
    <tr
      className="border-t border-border-subtle"
      onKeyDown={editField ? handleKeyDown : undefined}
    >
      <td className="px-4 py-3 text-sm text-content-primary font-medium">
        {account.accountName}
      </td>
      <td className="px-4 py-3">
        <Badge variant={ACCOUNT_TYPE_VARIANT[account.accountType] ?? 'neutral'}>
          {account.accountType.toUpperCase()}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm font-mono text-content-secondary text-right">
        {fmt(account.contributions)}
      </td>
      <td className="px-4 py-3 text-sm font-mono text-content-secondary text-right">
        {fmt(account.withdrawals)}
      </td>
      <td className="px-4 py-3 text-right">
        <EditableCell
          value={account.annualLimit}
          isEditing={editField === 'annualLimit'}
          editValue={editValue}
          onStartEdit={() => startEdit('annualLimit')}
          onEditChange={setEditValue}
          isLoading={mutation.isPending}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <EditableCell
          value={account.roomCarried}
          isEditing={editField === 'roomCarried'}
          editValue={editValue}
          onStartEdit={() => startEdit('roomCarried')}
          onEditChange={setEditValue}
          isLoading={mutation.isPending}
          suffix={roomCarriedSuffix}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <span className={availableRoomClass}>
          {account.availableRoom !== null ? fmt(account.availableRoom) : '—'}
        </span>
      </td>
      {editField && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={mutation.isPending}
              className="text-xs text-info hover:underline disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={cancelEdit}
              className="text-xs text-content-muted hover:text-content-primary"
            >
              Cancel
            </button>
          </div>
        </td>
      )}
      {!editField && <td />}
    </tr>
  );
}
