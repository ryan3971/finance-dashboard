import type { RebalancingGroup } from '@finance/shared/types/rebalancing';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn, fmt, MONTH_LABELS, parseAmount } from '@/lib/utils';
import {
  useConfirmRefund,
  useDismissRefund,
} from '@/features/transactions/hooks/useRebalancingMutations';

function fmtDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const month = parseInt(parts[1] ?? '1', 10);
  const day = parseInt(parts[2] ?? '1', 10);
  return `${MONTH_LABELS[month - 1] ?? parts[1]} ${day}`;
}

function RefundTransactionRow({
  label,
  date,
  description,
  accountName,
  amount,
}: {
  readonly label: string;
  readonly date: string;
  readonly description: string;
  readonly accountName: string;
  readonly amount: string;
}) {
  const parsed = parseAmount(amount);
  const isCredit = parsed > 0;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border-subtle text-sm">
      <span className="w-14 shrink-0 text-content-muted font-mono text-xs">
        {fmtDate(date)}
      </span>
      <span className="w-12 shrink-0 text-xs font-semibold text-content-muted uppercase tracking-wider">
        {label}
      </span>
      <span className="flex-1 min-w-0 truncate text-content-primary">
        {description}
      </span>
      <span className="hidden sm:block shrink-0 text-xs text-content-secondary">
        {accountName}
      </span>
      <span
        className={cn(
          'shrink-0 font-mono font-medium',
          isCredit ? 'text-positive' : 'text-danger'
        )}
      >
        {isCredit ? '+' : ''}
        {fmt(parsed)}
      </span>
    </div>
  );
}

export function RefundGroupCard({
  group,
}: {
  readonly group: RebalancingGroup;
}) {
  const confirmRefund = useConfirmRefund();
  const dismissRefund = useDismissRefund();

  const isResolved = group.status === 'resolved';
  const anyPending = confirmRefund.isPending || dismissRefund.isPending;

  const source = group.transactions.find((t) => t.role === 'source');
  const offset = group.transactions.find((t) => t.role === 'offset');

  return (
    <div className={cn('bg-surface rounded-lg border border-border-base overflow-hidden', isResolved && 'opacity-50')}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-content-primary">
            {group.label}
          </span>
          <Badge variant={isResolved ? 'success' : 'warning'} rounded="sm">
            {isResolved ? 'Confirmed' : 'Pending'}
          </Badge>
        </div>
        {!isResolved && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="primary"
              disabled={anyPending}
              onClick={() => confirmRefund.mutate(group.id)}
            >
              {confirmRefund.isPending ? '…' : 'Confirm'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={anyPending}
              onClick={() => dismissRefund.mutate(group.id)}
            >
              {dismissRefund.isPending ? '…' : 'Dismiss'}
            </Button>
          </div>
        )}
      </div>

      {/* Transactions */}
      {source && (
        <RefundTransactionRow
          label="Charge"
          date={source.date}
          description={source.description}
          accountName={source.accountName}
          amount={source.amount}
        />
      )}
      {offset && (
        <RefundTransactionRow
          label="Credit"
          date={offset.date}
          description={offset.description}
          accountName={offset.accountName}
          amount={offset.amount}
        />
      )}
    </div>
  );
}
