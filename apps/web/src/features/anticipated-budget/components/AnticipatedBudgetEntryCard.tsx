import type { AnticipatedBudgetEntry } from '@finance/shared/types/anticipated-budget';
import { Badge } from '@/components/ui/Badge';
import { DeleteEntryDialog } from './DeleteEntryDialog';
import { EditEntryDialog } from './EditEntryDialog';
import { MonthChips } from './MonthChips';
import { fmt } from '@/lib/utils';
import { useState } from 'react';
import {
  useDeleteEntry,
  useDeleteMonthOverride,
  useUpdateEntry,
  useUpsertMonthOverride,
} from '../hooks/useAnticipatedBudgetMutations';

interface Props {
  readonly entry: AnticipatedBudgetEntry;
}

export function AnticipatedBudgetEntryCard({ entry }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const upsertOverride = useUpsertMonthOverride();
  const deleteOverride = useDeleteMonthOverride();
  const deleteEntry = useDeleteEntry();
  const updateEntry = useUpdateEntry();

  const yearlyTotal = entry.months.reduce((sum, m) => sum + m.amount, 0);
  const overrideCount = entry.months.filter((m) => m.isOverride).length;

  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      {/* Collapsed header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <button
          className="flex-1 flex items-center gap-3 text-left min-w-0"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="text-sm font-medium text-content-primary truncate">
            {entry.name}
          </span>
          {entry.categoryName && (
            <span className="text-xs text-content-muted shrink-0">
              {entry.categoryName}
            </span>
          )}

          {entry.needWant === 'Need' && <Badge variant="info">Need</Badge>}
          {entry.needWant === 'Want' && <Badge variant="accent">Want</Badge>}

          {overrideCount > 0 && (
            <span className="ml-auto shrink-0 text-xs bg-info-subtle text-info border border-info-border rounded px-1.5 py-0.5">
              +{overrideCount} override{overrideCount !== 1 ? 's' : ''}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 shrink-0 group">
          <div className="text-right">
            <p className="text-xs text-content-muted">
              {entry.monthlyAmount !== null
                ? `${fmt(entry.monthlyAmount)}/mo`
                : 'Varies'}
            </p>
            <p className="text-sm font-medium font-mono text-content-primary">
              {fmt(yearlyTotal)}/yr
            </p>
          </div>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity text-content-muted hover:text-content-primary text-xs"
            onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
            title="Edit entry"
            aria-label="Edit entry"
          >
            ✎
          </button>
          <button
            className="text-content-muted hover:text-danger transition-colors text-xs"
            onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true); }}
            title="Delete entry"
            aria-label="Delete entry"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Notes */}
      {entry.notes && (
        <p className="px-4 pb-2 text-xs italic text-content-muted">
          {entry.notes}
        </p>
      )}

      {/* Expanded month chips */}
      {expanded && (
        <div className="px-4 pb-4">
          <MonthChips
            months={entry.months}
            onSave={(month, amount) =>
              upsertOverride.mutate({
                entryId: entry.id,
                month,
                input: { amount },
              })
            }
            onRemove={(month) =>
              deleteOverride.mutate({ entryId: entry.id, month })
            }
            isSaving={upsertOverride.isPending || deleteOverride.isPending}
          />
        </div>
      )}

      <DeleteEntryDialog
        entryName={confirmingDelete ? entry.name : null}
        isPending={deleteEntry.isPending}
        onConfirm={() => deleteEntry.mutate(entry.id)}
        onCancel={() => setConfirmingDelete(false)}
      />

      {editOpen && (
        <EditEntryDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          entry={entry}
          isPending={updateEntry.isPending}
          onSubmit={(data) => {
            updateEntry.mutate(
              { id: entry.id, patch: data },
              { onSuccess: () => setEditOpen(false) }
            );
          }}
        />
      )}
    </div>
  );
}
