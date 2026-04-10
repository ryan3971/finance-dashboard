import { DEFAULT_CURRENCY } from '@finance/shared';
import { parseAmount } from '@/lib/utils';

function formatAmount(amount: number): string {
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
  }).format(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : `+${formatted}`;
}

interface AmountCellProps {
  readonly amount: string;
  readonly isTransfer: boolean;
}

export function AmountCell({ amount, isTransfer }: AmountCellProps) {
  const num = parseAmount(amount);
  let colorClass: string;
  if (isTransfer) {
    colorClass = 'text-content-muted';
  } else if (num > 0) {
    colorClass = 'text-positive';
  } else {
    colorClass = 'text-danger';
  }
  return (
    <span className={`font-mono text-sm font-medium ${colorClass}`}>
      {formatAmount(num)}
    </span>
  );
}
