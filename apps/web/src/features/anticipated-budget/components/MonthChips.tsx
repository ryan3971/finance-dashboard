import type { AnticipatedBudgetMonth } from '@finance/shared';
import { MONTH_LABELS } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface MonthChipProps {
  readonly monthData: AnticipatedBudgetMonth;
  readonly onSave: (amount: string) => void;
  readonly onRemove: () => void;
  readonly isSaving: boolean;
}

function MonthChip({ monthData, onSave, onRemove, isSaving }: MonthChipProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(monthData.amount);

  function handleOpen() {
    setValue(monthData.amount);
    setEditing(true);
  }

  function handleSave() {
    if (value.trim() === '' || value === '0' || value === '0.00') {
      onRemove();
    } else {
      onSave(value.trim());
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setEditing(false);
  }

  const chipBase =
    'rounded px-2 py-1 text-xs font-medium cursor-pointer transition-colors border';
  const defaultChip = `${chipBase} bg-surface-muted text-content-secondary border-transparent hover:border-border-strong`;
  const overrideChip = `${chipBase} bg-info-subtle text-info border-info-border`;

  if (editing) {
    return (
      <div className="flex flex-col gap-1 p-2 bg-surface-subtle rounded border border-border-base">
        <p className="text-xs font-medium text-content-secondary">
          {MONTH_LABELS[monthData.month - 1]}
        </p>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="input-base text-xs py-0.5"
          placeholder="0.00"
        />
        <p className="text-xs text-content-muted">Clear to revert to default</p>
        <div className="flex gap-1 mt-1">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            Save
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      className={monthData.isOverride ? overrideChip : defaultChip}
      onClick={handleOpen}
      title={`${MONTH_LABELS[monthData.month - 1]}: ${monthData.amount}${monthData.isOverride ? ' (override)' : ''}`}
    >
      <span className="block text-[10px] leading-none mb-0.5">
        {MONTH_LABELS[monthData.month - 1]}
      </span>
      <span className="block font-mono">${monthData.amount}</span>
    </button>
  );
}

interface Props {
  //entryId: string;
  readonly months: AnticipatedBudgetMonth[];
  readonly onSave: (month: number, amount: string) => void;
  readonly onRemove: (month: number) => void;
  readonly isSaving: boolean;
}

export function MonthChips({ months, onSave, onRemove, isSaving }: Props) {
  return (
    <div className="grid grid-cols-6 gap-2 pt-3 border-t border-border-subtle">
      {months.map((m) => (
        <MonthChip
          key={m.month}
          monthData={m}
          onSave={(amount) => onSave(m.month, amount)}
          onRemove={() => onRemove(m.month)}
          isSaving={isSaving}
        />
      ))}
    </div>
  );
}
