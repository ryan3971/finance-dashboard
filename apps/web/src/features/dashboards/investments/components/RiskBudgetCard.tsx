import { useState } from 'react';
import { cn, fmt } from '@/lib/utils';
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
  readonly year: number;
  readonly isFetching: boolean;
}

export function RiskBudgetCard({ data, year, isFetching }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const mutation = useUpdateRiskSettings(year);

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
        <h2 className="text-sm font-medium text-content-primary">Risk Budget</h2>
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

      <div className="px-4 py-4">
        {!hasPercentage && data.riskyInvested === 0 && (
          <p className="text-sm text-content-muted">
            Set a risky investment percentage to track your risk budget.
          </p>
        )}

        {!hasPercentage && data.riskyInvested > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-content-secondary">Invested</span>
              <span className="font-mono font-medium text-content-primary">
                {fmt(data.riskyInvested)}
              </span>
            </div>
            <p className="text-xs text-content-muted">
              Set a risky investment percentage above to track your budget.
            </p>
          </div>
        )}

        {hasPercentage && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-content-secondary">Available</span>
              <span className="font-mono font-medium text-content-primary">
                {fmt(data.riskyBudget ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-content-secondary">Invested</span>
              <span className="font-mono font-medium text-content-primary">
                {fmt(data.riskyInvested)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-content-secondary">Remaining</span>
              <span
                className={cn(
                  'font-mono font-medium',
                  isOverBudget ? 'text-danger' : 'text-positive'
                )}
              >
                {fmt(data.remaining ?? 0)}
                {isOverBudget && (
                  <span className="ml-1 text-xs font-normal">over budget</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
