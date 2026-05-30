import { cn, fmt } from '@/lib/utils';
import type { InvestmentTransactionAggregates } from '@finance/shared/types/investments';

interface Props {
  readonly aggregates: InvestmentTransactionAggregates | undefined;
}

export function ActivityStatsBar({ aggregates }: Props) {
  if (!aggregates) return null;

  const { dividends, fees, netDeposits } = aggregates;
  if (dividends === 0 && fees === 0 && netDeposits === 0) return null;

  return (
    <div className="flex items-center gap-3 text-sm text-content-secondary">
      <span>
        Dividends:{' '}
        <span className="font-mono font-medium text-positive">{fmt(dividends)}</span>
      </span>
      <span className="text-border-base">·</span>
      <span>
        Fees:{' '}
        <span className={cn('font-mono font-medium', fees >= 0 ? 'text-danger' : 'text-positive')}>
          {fmt(fees)}
        </span>
      </span>
      <span className="text-border-base">·</span>
      <span>
        Net Deposits:{' '}
        <span className={cn('font-mono font-medium', netDeposits >= 0 ? 'text-positive' : 'text-danger')}>
          {fmt(netDeposits)}
        </span>
      </span>
    </div>
  );
}
