import { useState } from 'react';
import { toast } from 'sonner';
import { cn, fmt } from '@/lib/utils';
import { TOAST } from '@/lib/toastMessages';
import { SectionHelp } from '@/components/common/SectionHelp';
import type { RiskBudgetResponse } from '@finance/shared/types/investments';
import { useUpdateRiskSettings } from '../hooks/useRiskBudgetMutations';

function PencilIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

interface PercentageEditorProps {
  readonly value: number | null;
  readonly isEditing: boolean;
  readonly editValue: string;
  readonly onStartEdit: () => void;
  readonly onEditChange: (v: string) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
  readonly isLoading: boolean;
}

function PercentageEditor({
  value,
  isEditing,
  editValue,
  onStartEdit,
  onEditChange,
  onSave,
  onCancel,
  isLoading,
}: PercentageEditorProps) {
  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
          className="input-base w-16 text-sm text-right"
          disabled={isLoading}
          autoFocus
        />
        <span className="text-xs text-content-secondary">%</span>
        <button
          onClick={onSave}
          disabled={isLoading}
          className="text-xs text-info hover:underline disabled:opacity-50 ml-1"
        >
          Save
        </button>
        <button onClick={onCancel} className="text-xs text-content-muted hover:text-content-primary">
          Cancel
        </button>
      </span>
    );
  }

  if (value === null) {
    return (
      <button onClick={onStartEdit} className="text-xs text-info hover:underline">
        Add %
      </button>
    );
  }

  return (
    <span className="group inline-flex items-center gap-1.5">
      <span className="text-sm font-mono text-content-secondary">{value}%</span>
      <span className="text-xs text-content-muted">of contributions</span>
      <button
        onClick={onStartEdit}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-content-muted hover:text-content-primary"
        aria-label="Edit risk percentage"
      >
        <PencilIcon />
      </button>
    </span>
  );
}

interface Props {
  readonly data: RiskBudgetResponse;
  readonly isFetching: boolean;
}

export function RiskBudgetCard({ data, isFetching }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const mutation = useUpdateRiskSettings();

  function startEdit() {
    setEditValue(data.riskyPercentage?.toString() ?? '');
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditValue('');
  }

  function handleSave() {
    const num = parseInt(editValue, 10);
    if (isNaN(num) || num < 0 || num > 100) {
      toast.error(TOAST.RISK_SETTINGS_SAVE_FAILED);
      cancelEdit();
      return;
    }
    mutation.mutate({ riskyPercentage: num }, { onSuccess: cancelEdit });
  }

  const hasPercentage = data.riskyPercentage !== null;
  const isOverBudget = data.remaining !== null && data.remaining < 0;

  return (
    <div
      className={cn(
        'bg-surface rounded-lg border border-border-base overflow-hidden transition-opacity duration-200',
        isFetching && 'opacity-50'
      )}
    >
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-content-primary">Risk Budget</h2>
          <SectionHelp contentKey="investments.riskBudget" />
        </div>
        <PercentageEditor
          value={data.riskyPercentage}
          isEditing={isEditing}
          editValue={editValue}
          onStartEdit={startEdit}
          onEditChange={setEditValue}
          onSave={handleSave}
          onCancel={cancelEdit}
          isLoading={mutation.isPending}
        />
      </div>

      {!hasPercentage && (
        <div className="px-4 py-4">
          {data.riskyInvested > 0 ? (
            <p className="text-sm text-content-muted">
              Invested:{' '}
              <span className="font-mono font-medium text-content-primary">
                {fmt(data.riskyInvested)}
              </span>
              {' — '}set a percentage above to track your budget.
            </p>
          ) : (
            <p className="text-sm text-content-muted">
              Set a risky investment percentage to track your risk budget.
            </p>
          )}
        </div>
      )}

      {hasPercentage && (
        <div className="grid grid-cols-3 divide-x divide-border-subtle">
          <div className="px-4 py-4">
            <p className="text-xs text-content-muted mb-1">Available</p>
            <p className="text-base font-mono font-medium text-content-primary">
              {fmt(data.riskyBudget ?? 0)}
            </p>
          </div>
          <div className="px-4 py-4">
            <p className="text-xs text-content-muted mb-1">Invested</p>
            <p className="text-base font-mono font-medium text-content-primary">
              {fmt(data.riskyInvested)}
            </p>
          </div>
          <div className="px-4 py-4">
            <p className="text-xs text-content-muted mb-1">Remaining</p>
            <p className={cn('text-base font-mono font-medium', isOverBudget ? 'text-danger' : 'text-positive')}>
              {fmt(data.remaining ?? 0)}
            </p>
            {isOverBudget && (
              <p className="text-xs text-danger mt-0.5">over budget</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
