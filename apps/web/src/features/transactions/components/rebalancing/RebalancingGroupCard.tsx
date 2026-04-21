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

function TotalsRow({ group }: { readonly group: RebalancingGroup }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 border-t border-border-subtle bg-surface-subtle text-sm">
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
      <span className="text-content-secondary">
        My share:{' '}
        <span
          className={cn(
            'font-mono font-medium',
            group.myShare > 0 ? 'text-danger' : 'text-content-primary'
          )}
        >
          {fmt(group.myShare)}
        </span>
        {group.myShareOverride !== null && (
          <span className="ml-1 text-xs text-content-muted">(override)</span>
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
  readonly onRemove: () => void;
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
  groupId,
  isPending,
}: {
  readonly title: string;
  readonly transactions: RebalancingGroup['transactions'];
  readonly groupId: string;
  readonly isPending: boolean;
}) {
  const removeMember = useRemoveGroupMember();

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
          isPending={isPending || removeMember.isPending}
          onRemove={() => removeMember.mutate({ groupId, transactionId: t.transactionId })}
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
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const isResolved = group.status === 'resolved';
  const isUpdating = updateGroup.isPending;
  const isDeleting = deleteGroup.isPending;
  const anyPending = isUpdating || isDeleting;

  const toggleLabel = isUpdating ? '…' : isResolved ? 'Re-open' : 'Mark Resolved';

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
          groupId={group.id}
          isPending={anyPending}
        />
        <TransactionSection
          title="Offsets"
          transactions={offsets}
          groupId={group.id}
          isPending={anyPending}
        />

        {/* Totals */}
        <TotalsRow group={group} />
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
