import { useState } from 'react';

import type { RebalancingGroup } from '@finance/shared/types/rebalancing';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { cn, fmt, MONTH_LABELS, parseAmount } from '@/lib/utils';
import {
  useDeleteGroup,
  useRemoveGroupMember,
  useUpdateGroup,
} from '@/features/transactions/hooks/useRebalancingMutations';

function fmtDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const month = parseInt(parts[1] ?? '1', 10);
  const day = parseInt(parts[2] ?? '1', 10);
  return `${MONTH_LABELS[month - 1] ?? parts[1]} ${day}`;
}

interface TotalsRowProps {
  readonly group: RebalancingGroup;
  readonly isEditingOverride: boolean;
  readonly overrideInput: string;
  readonly isUpdating: boolean;
  readonly onOverrideInputChange: (val: string) => void;
  readonly onEditOverride: () => void;
  readonly onSaveOverride: () => void;
  readonly onClearOverride: () => void;
  readonly onCancelOverride: () => void;
}

function TotalsRow({
  group,
  isEditingOverride,
  overrideInput,
  isUpdating,
  onOverrideInputChange,
  onEditOverride,
  onSaveOverride,
  onClearOverride,
  onCancelOverride,
}: TotalsRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 border-t border-border-subtle bg-surface-subtle text-sm">
      <span className="text-content-secondary">
        Source total:{' '}
        <span className="font-mono font-medium text-content-primary">
          {fmt(group.sourceTotal)}
        </span>
      </span>
      <span className="text-content-secondary">
        Offset total:{' '}
        <span className="font-mono font-medium text-positive">
          {fmt(group.offsetTotal)}
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-content-secondary">
        My share:{' '}
        {isEditingOverride ? (
          <>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={overrideInput}
              onChange={(e) => onOverrideInputChange(e.target.value)}
              autoFocus
              className="w-24 rounded border border-border-strong bg-surface px-2 py-0.5 text-sm font-mono text-content-primary focus:outline-none focus:ring-1 focus:ring-border-strong"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveOverride();
                if (e.key === 'Escape') onCancelOverride();
              }}
            />
            <button
              type="button"
              className="text-xs font-medium text-content-primary hover:text-positive disabled:opacity-50"
              disabled={isUpdating}
              onClick={onSaveOverride}
            >
              Save
            </button>
            <button
              type="button"
              className="text-xs text-content-muted hover:text-content-secondary"
              onClick={onCancelOverride}
            >
              Cancel
            </button>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-mono font-medium',
                group.myShare > 0 ? 'text-danger' : 'text-content-primary'
              )}
            >
              {fmt(group.myShare)}
            </span>
            {group.myShareOverride !== null ? (
              <>
                <span className="text-xs text-content-muted">
                  (originally {fmt(Math.max(0, group.sourceTotal - group.offsetTotal))})
                </span>
                <button
                  type="button"
                  className="text-xs text-content-muted hover:text-content-primary transition-colors"
                  onClick={onEditOverride}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs text-content-muted hover:text-danger transition-colors disabled:opacity-50"
                  disabled={isUpdating}
                  onClick={onClearOverride}
                >
                  Reset
                </button>
              </>
            ) : (
              <button
                type="button"
                className="text-xs text-content-muted hover:text-content-primary transition-colors"
                onClick={onEditOverride}
              >
                Override
              </button>
            )}
          </span>
        )}
      </span>
    </div>
  );
}

interface TransactionRowProps {
  readonly date: string;
  readonly description: string;
  readonly accountName: string;
  readonly categoryName: string | null;
  readonly subcategoryName: string | null;
  readonly amount: string;
  readonly isPending: boolean;
  readonly onRemove: () => void; // fires useRemoveGroupMember.mutate, hoisted to card level
}

function TransactionRow({
  date,
  description,
  accountName,
  categoryName,
  subcategoryName,
  amount,
  isPending,
  onRemove,
}: TransactionRowProps) {
  let categoryPath: string | null = null;
  if (categoryName && subcategoryName) {
    categoryPath = `${categoryName} › ${subcategoryName}`;
  } else if (categoryName) {
    categoryPath = categoryName;
  } else if (subcategoryName) {
    categoryPath = subcategoryName;
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 border-t border-border-subtle text-sm">
      <span className="w-14 shrink-0 text-content-muted font-mono text-xs">
        {fmtDate(date)}
      </span>
      <span className="flex-1 min-w-0 truncate text-content-primary">
        {description}
      </span>
      <span className="hidden sm:block shrink-0 text-content-secondary text-xs">
        {accountName}
        {categoryPath && (
          <span className="text-content-muted"> · {categoryPath}</span>
        )}
      </span>
      <span className="shrink-0 font-mono font-medium text-content-primary">
        {fmt(Math.abs(parseAmount(amount)))}
      </span>
      <button
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-content-muted hover:text-danger disabled:opacity-30"
        title="Remove from group"
        disabled={isPending}
        onClick={onRemove}
      >
        ✕
      </button>
    </div>
  );
}

function TransactionSection({
  title,
  transactions,
  isPending,
  onRemove,
}: {
  readonly title: string;
  readonly transactions: RebalancingGroup['transactions'];
  readonly isPending: boolean;
  readonly onRemove: (transactionId: string) => void;
}) {
  if (transactions.length === 0) return null;
  return (
    <div>
      <p className="px-4 pt-2.5 pb-0.5 text-xs font-semibold text-content-muted uppercase tracking-wider">
        {title}
      </p>
      {transactions.map((t) => (
        <TransactionRow
          key={t.transactionId}
          date={t.date}
          description={t.description}
          accountName={t.accountName}
          categoryName={t.categoryName}
          subcategoryName={t.subcategoryName}
          amount={t.amount}
          isPending={isPending}
          onRemove={() => onRemove(t.transactionId)}
        />
      ))}
    </div>
  );
}

export function RebalancingGroupCard({
  group,
}: {
  readonly group: RebalancingGroup;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditingOverride, setIsEditingOverride] = useState(false);
  const [overrideInput, setOverrideInput] = useState('');
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const removeMember = useRemoveGroupMember();

  const isResolved = group.status === 'resolved';
  const isUpdating = updateGroup.isPending;
  const isDeleting = deleteGroup.isPending;
  // Include removeMember so both sections are disabled while any removal is in flight,
  // preventing concurrent mutations across sections.
  const anyPending = isUpdating || isDeleting || removeMember.isPending;

  const resolvedToggleLabel = isResolved ? 'Re-open' : 'Mark Resolved';
  const toggleLabel = isUpdating ? '…' : resolvedToggleLabel;

  const sources = group.transactions.filter((t) => t.role === 'source');
  const offsets = group.transactions.filter((t) => t.role === 'offset');

  function handleToggleStatus() {
    updateGroup.mutate({
      id: group.id,
      input: { status: isResolved ? 'open' : 'resolved' },
    });
  }

  function handleDeleteConfirm() {
    deleteGroup.mutate(group.id, {
      onSuccess: () => setConfirmDelete(false),
    });
  }

  function handleEditOverride() {
    const initial = group.myShareOverride !== null ? String(group.myShareOverride) : '';
    setOverrideInput(initial);
    setIsEditingOverride(true);
  }

  function handleSaveOverride() {
    const val = parseFloat(overrideInput);
    if (!overrideInput || isNaN(val) || val <= 0) return;
    updateGroup.mutate(
      { id: group.id, input: { myShareOverride: val } },
      { onSuccess: () => setIsEditingOverride(false) }
    );
  }

  function handleClearOverride() {
    updateGroup.mutate({ id: group.id, input: { myShareOverride: null } });
  }

  function handleCancelOverride() {
    setIsEditingOverride(false);
    setOverrideInput('');
  }

  return (
    <>
      <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {group.flaggedForReview && (
              <Badge variant="warning" rounded="sm">
                Review
              </Badge>
            )}
            <span className="text-sm font-medium text-content-primary truncate">
              {group.label}
            </span>
            <Badge variant={isResolved ? 'success' : 'neutral'} rounded="sm">
              {isResolved ? 'Resolved' : 'Open'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant={isResolved ? 'secondary' : 'primary'}
              disabled={anyPending}
              onClick={handleToggleStatus}
            >
              {toggleLabel}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={anyPending}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Transactions */}
        <TransactionSection
          title="Sources"
          transactions={sources}
          isPending={anyPending}
          onRemove={(txId) => removeMember.mutate({ groupId: group.id, transactionId: txId })}
        />
        <TransactionSection
          title="Offsets"
          transactions={offsets}
          isPending={anyPending}
          onRemove={(txId) => removeMember.mutate({ groupId: group.id, transactionId: txId })}
        />

        {/* Totals */}
        <TotalsRow
          group={group}
          isEditingOverride={isEditingOverride}
          overrideInput={overrideInput}
          isUpdating={anyPending}
          onOverrideInputChange={setOverrideInput}
          onEditOverride={handleEditOverride}
          onSaveOverride={handleSaveOverride}
          onClearOverride={handleClearOverride}
          onCancelOverride={handleCancelOverride}
        />
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete group?</DialogTitle>
            <DialogDescription>
              "{group.label}" will be permanently deleted. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              size="md"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
